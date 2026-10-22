import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { createApp } from './app.js';
import type { AegisApp } from './app.js';
import { quizQuestions } from '../shared/quiz.js';
import type { AppState } from '../shared/types.js';

let directory: string;
let app: AegisApp;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'aegis-api-'));
  app = createApp({ dataDir: directory });
});
afterEach(async () => { await app.locals.close(); rmSync(directory, { recursive: true, force: true }); });

function log(overrides: Record<string, unknown> = {}) {
  return { timestamp: '2026-10-21T10:00:00.000Z', severity: 'medium', sourceIp: '198.51.100.123', destinationIp: '10.24.2.18',
    event: 'failed_login', message: 'Imported authentication failure for analyst review.', ...overrides };
}

describe('local console state and persistence', () => {
  it('returns labeled sample state without invented actual scans', async () => {
    const result = await request(app).get('/api/state').expect(200);
    const state: AppState = result.body;
    expect(state.mode).toBe('simulation'); expect(state.assets).toHaveLength(8); expect(state.alerts).toHaveLength(7);
    expect(state.logs).toHaveLength(30); expect(state.rules).toHaveLength(4); expect(state.nistControls).toHaveLength(12);
    expect(state.scans).toEqual([]); expect(state.assets.every(asset => asset.origin === 'sample')).toBe(true);
    const health = await request(app).get('/api/health').expect(200);
    expect(health.body.lab).toEqual({ host: '127.0.0.1', ports: [9091, 9092, 9093], listeningPort: 0 });
  });

  it('isolates model assets with an audit reason and persists across a fresh app', async () => {
    await request(app).post('/api/assets/ast-01/action').send({ action: 'isolate', reason: 'Investigating a credible training alert.' }).expect(200);
    await app.locals.close(); app = createApp({ dataDir: directory });
    const state: AppState = (await request(app).get('/api/state')).body;
    expect(state.assets.find(asset => asset.id === 'ast-01')?.status).toBe('isolated');
    expect(state.actions[0]).toMatchObject({ action: 'isolate asset', mode: 'simulation', target: 'ast-01' });
    expect(state.actions[0].result).toContain('No remote device');
    expect(readdirSync(directory)).toEqual(['state.json']);
  });

  it('rejects actions without reasons and arbitrary commands without changing stored state', async () => {
    const before = readFileSync(join(directory, 'state.json'), 'utf8');
    await request(app).post('/api/assets/ast-01/action').send({ action: 'isolate', reason: 'no' }).expect(400);
    await request(app).post('/api/assets/ast-01/action').send({ action: 'shell', reason: 'test command', command: 'anything' }).expect(400);
    await request(app).post('/api/assets/unknown/action').send({ action: 'release', reason: 'valid reason' }).expect(404);
    expect(readFileSync(join(directory, 'state.json'), 'utf8')).toBe(before);
  });

  it('keeps an isolated asset contained during investigation until explicitly released', async () => {
    await request(app).post('/api/assets/ast-04/action').send({ action: 'isolate', reason: 'Preserve the workstation for investigation.' }).expect(200);
    const investigation = await request(app).post('/api/assets/ast-04/action').send({ action: 'investigate', reason: 'Review local evidence while keeping the model contained.' }).expect(200);
    expect(investigation.body.status).toBe('isolated');
    const state = (await request(app).get('/api/state')).body as AppState;
    expect(state.actions[0]).toMatchObject({ action: 'investigate asset', target: 'ast-04', mode: 'simulation' });
    expect(state.actions[0].result).toContain('remains isolated');
    expect(state.alerts.filter(alert => alert.targetId === 'ast-04' && alert.status !== 'resolved').every(alert => alert.status === 'contained')).toBe(true);
    const released = await request(app).post('/api/assets/ast-04/action').send({ action: 'release', reason: 'Authorized release after evidence review.' }).expect(200);
    expect(released.body.status).toBe('online');
  });

  it('updates alert status and rejects unknown states', async () => {
    const initial = (await request(app).get('/api/state')).body as AppState;
    const id = initial.alerts[0].id;
    const result = await request(app).post(`/api/alerts/${id}/status`).send({ status: 'resolved' }).expect(200);
    expect(result.body.status).toBe('resolved');
    await request(app).post(`/api/alerts/${id}/status`).send({ status: 'compromised' }).expect(400);
  });

  it('preserves malformed persisted data instead of silently replacing it', async () => {
    await app.locals.close(); writeFileSync(join(directory, 'state.json'), '{broken');
    expect(() => createApp({ dataDir: directory })).toThrow('Preserve state.json');
    expect(readFileSync(join(directory, 'state.json'), 'utf8')).toBe('{broken');
  });

  it('blocks cross-site changes while allowing the local same-origin workflow', async () => {
    await request(app).post('/api/watchlist').set('Origin', 'https://malicious.example').send({ ip: '198.51.100.123' }).expect(403);
    await request(app).post('/api/watchlist').set('Sec-Fetch-Site', 'cross-site').send({ ip: '198.51.100.123' }).expect(403);
    await request(app).post('/api/watchlist').set('Origin', 'http://localhost:5173').send({ ip: '198.51.100.123' }).expect(201);
  });

  it('rejects invalid JSON and unknown API routes with structured errors', async () => {
    const invalid = await request(app).post('/api/watchlist').type('json').send('{invalid').expect(400);
    expect(invalid.body.error).toContain('valid JSON');
    await request(app).get('/api/missing').expect(404);
  });

  it('publishes a state event after an actually persisted mutation', async () => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('SSE port unavailable.');
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/events`, { signal: controller.signal });
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const reader = response.body!.getReader();
      const ready = await reader.read();
      expect(new TextDecoder().decode(ready.value)).toContain('event: ready');
      await request(app).post('/api/watchlist').send({ ip: '198.51.100.123' }).expect(201);
      const update = await reader.read();
      const event = new TextDecoder().decode(update.value);
      expect(event).toContain('event: state');
      expect(event).toContain('updatedAt');
      expect(JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8')).watchlist).toContain('198.51.100.123');
      await reader.cancel();
    } finally {
      clearTimeout(deadline); controller.abort();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});

describe('simulated firewall and watchlist', () => {
  const rule = { name: 'Allow training web', direction: 'inbound', action: 'allow', source: '198.51.100.0/24', destination: '10.24.0.0/16', protocol: 'TCP', port: 8443, enabled: true };
  const packet = { source: '198.51.100.123', destination: '10.24.2.18', protocol: 'TCP', port: 8443 };

  it('evaluates enabled CIDR rules in order and denies unmatched packets', async () => {
    const seed = (await request(app).get('/api/state')).body as AppState;
    for (const entry of seed.rules) await request(app).delete(`/api/firewall/rules/${entry.id}`).expect(204);
    const first = await request(app).post('/api/firewall/rules').send(rule).expect(201);
    await request(app).post('/api/firewall/rules').send({ ...rule, name: 'Later overlapping deny', action: 'deny' }).expect(201);
    const allowed = await request(app).post('/api/firewall/evaluate').send(packet).expect(200);
    expect(allowed.body).toMatchObject({ action: 'allow', mode: 'simulation', matchedRule: { id: first.body.id } });
    expect(allowed.body.explanation).toContain('no operating-system');
    const denied = await request(app).post('/api/firewall/evaluate').send({ ...packet, source: '203.0.113.44' }).expect(200);
    expect(denied.body).toMatchObject({ action: 'deny', matchedRule: null });
    await request(app).post(`/api/firewall/rules/${first.body.id}/toggle`).send({ enabled: false }).expect(200);
    expect((await request(app).post('/api/firewall/evaluate').send(packet)).body.action).toBe('deny');
  });

  it('supports /0 and /32 selectors, UDP, and any ports', async () => {
    const seed = (await request(app).get('/api/state')).body as AppState;
    for (const entry of seed.rules) await request(app).delete(`/api/firewall/rules/${entry.id}`);
    await request(app).post('/api/firewall/rules').send({ ...rule, source: '0.0.0.0/0', destination: '10.24.2.18/32', protocol: 'ANY', port: null }).expect(201);
    expect((await request(app).post('/api/firewall/evaluate').send({ ...packet, source: '203.0.113.200', protocol: 'UDP', port: 53 })).body.action).toBe('allow');
    expect((await request(app).post('/api/firewall/evaluate').send({ ...packet, destination: '10.24.2.19' })).body.action).toBe('deny');
  });

  it('matches traffic direction before applying rule order and defaults omitted direction to inbound', async () => {
    const seed = (await request(app).get('/api/state')).body as AppState;
    for (const entry of seed.rules) await request(app).delete(`/api/firewall/rules/${entry.id}`).expect(204);
    const outbound = await request(app).post('/api/firewall/rules').send({ ...rule, name: 'Deny outbound training traffic', direction: 'outbound', action: 'deny' }).expect(201);
    const inbound = await request(app).post('/api/firewall/rules').send(rule).expect(201);
    const implicit = await request(app).post('/api/firewall/evaluate').send(packet).expect(200);
    expect(implicit.body).toMatchObject({ action: 'allow', matchedRule: { id: inbound.body.id, direction: 'inbound' } });
    expect(implicit.body.explanation).toContain('matching inbound rule');
    const explicit = await request(app).post('/api/firewall/evaluate').send({ ...packet, direction: 'outbound' }).expect(200);
    expect(explicit.body).toMatchObject({ action: 'deny', matchedRule: { id: outbound.body.id, direction: 'outbound' } });
    expect(explicit.body.explanation).toContain('matching outbound rule');
    await request(app).delete(`/api/firewall/rules/${outbound.body.id}`).expect(204);
    const unmatched = await request(app).post('/api/firewall/evaluate').send({ ...packet, direction: 'outbound' }).expect(200);
    expect(unmatched.body).toMatchObject({ action: 'deny', matchedRule: null });
    expect(unmatched.body.explanation).toContain('No enabled outbound rule matched');
    await request(app).post('/api/firewall/evaluate').send({ ...packet, direction: 'both' }).expect(400);
    await request(app).post('/api/firewall/evaluate').send({ ...packet, direction: null }).expect(400);
  });

  it.each(['10.24.0.1/33', '10.24.0.1/-1', '10.24.0.1/1.5', '999.24.0.1', '01.2.3.4', 'example.com', '10.24.0.0/24/4'])('rejects invalid selector %s', async source => {
    await request(app).post('/api/firewall/rules').send({ ...rule, source }).expect(400);
  });

  it('validates evaluator fields and watchlist membership', async () => {
    await request(app).post('/api/firewall/evaluate').send({ ...packet, port: '8443' }).expect(400);
    await request(app).post('/api/firewall/evaluate').send({ ...packet, source: '10.0.0.0/8' }).expect(400);
    await request(app).post('/api/watchlist').send({ ip: '198.51.100.123' }).expect(201);
    await request(app).post('/api/watchlist').send({ ip: '198.51.100.123' }).expect(409);
    await request(app).delete('/api/watchlist/198.51.100.123').expect(204);
    await request(app).delete('/api/watchlist/198.51.100.123').expect(404);
  });

  it('canonicalizes IPv6 watchlist entries, detects equivalent duplicates, persists, and removes by equivalent form', async () => {
    const expanded = '2001:0DB8:0000:0000:0000:0000:0000:0042';
    const added = await request(app).post('/api/watchlist').send({ ip: expanded }).expect(201);
    expect(added.body.ip).toBe('2001:db8::42');
    await request(app).post('/api/watchlist').send({ ip: '2001:db8::42' }).expect(409);
    await app.locals.close(); app = createApp({ dataDir: directory });
    expect(((await request(app).get('/api/state')).body as AppState).watchlist).toContain('2001:db8::42');
    await request(app).delete(`/api/watchlist/${encodeURIComponent(expanded)}`).expect(204);
    expect(((await request(app).get('/api/state')).body as AppState).watchlist).not.toContain('2001:db8::42');
  });

  it('normalizes IPv4-mapped IPv6 but rejects scoped literals, hosts, ports, and CIDRs in the watchlist', async () => {
    const result = await request(app).post('/api/watchlist').send({ ip: '::ffff:192.0.2.42' }).expect(201);
    expect(result.body.ip).toBe('::ffff:c000:22a');
    await request(app).post('/api/watchlist').send({ ip: '0:0:0:0:0:ffff:c000:022a' }).expect(409);
    for (const ip of ['fe80::1%eth0', '[::1]', '127.0.0.1:3001', '2001:db8::/32', 'example.com']) {
      await request(app).post('/api/watchlist').send({ ip }).expect(400);
    }
  });
});

describe('all-or-nothing imports and honest rule detections', () => {
  it('correlates five failures within ten minutes, labels origin, and deduplicates overlapping alerts', async () => {
    const records = Array.from({ length: 5 }, (_, index) => log({ timestamp: `2026-10-21T10:0${index}:00.000Z` }));
    const result = await request(app).post('/api/logs/import').send({ text: JSON.stringify(records) }).expect(201);
    expect(result.body).toEqual({ imported: 5, alertsCreated: 1 });
    const state = (await request(app).get('/api/state')).body as AppState;
    expect(state.logs.filter(entry => entry.origin === 'imported')).toHaveLength(5);
    expect(state.alerts.find(entry => entry.origin === 'imported')).toMatchObject({ category: 'Authentication', sourceIp: '198.51.100.123', severity: 'high' });
    const repeat = await request(app).post('/api/logs/import').send({ text: JSON.stringify([log({ timestamp: '2026-10-21T10:05:00.000Z' })]) }).expect(201);
    expect(repeat.body.alertsCreated).toBe(0);
  });

  it('does not correlate separate source IPs or failures outside the ten-minute window', async () => {
    const records = Array.from({ length: 5 }, (_, index) => log({ timestamp: `2026-10-21T${String(10 + index).padStart(2, '0')}:00:00.000Z` }));
    const result = await request(app).post('/api/logs/import').send({ text: JSON.stringify(records) }).expect(201);
    expect(result.body.alertsCreated).toBe(0);
    const separate = Array.from({ length: 5 }, (_, index) => log({ sourceIp: `198.51.100.${150 + index}` }));
    expect((await request(app).post('/api/logs/import').send({ text: JSON.stringify(separate) })).body.alertsCreated).toBe(0);
  });

  it('detects a completed burst when newly imported evidence is chronologically older', async () => {
    const records = Array.from({ length: 4 }, (_, index) => log({ timestamp: `2026-10-21T10:0${index + 1}:00.000Z` }));
    await request(app).post('/api/logs/import').send({ text: JSON.stringify(records) }).expect(201);
    const older = await request(app).post('/api/logs/import').send({ text: JSON.stringify([log()]) }).expect(201);
    expect(older.body.alertsCreated).toBe(1);
  });

  it('accepts JSONL, detects flagged VPN events, and leaves normal VPN events alone', async () => {
    const records = [log({ event: 'vpn_anomaly', vpn: true, message: 'Unusual location flagged by original log source.' }), log({ event: 'vpn_connected', vpn: true, severity: 'info', message: 'Routine session established.' })];
    const result = await request(app).post('/api/logs/import').send({ text: records.map(record => JSON.stringify(record)).join('\n') }).expect(201);
    expect(result.body).toEqual({ imported: 2, alertsCreated: 1 });
    const state = (await request(app).get('/api/state')).body as AppState;
    expect(state.alerts.some(alert => alert.origin === 'imported' && alert.category === 'VPN')).toBe(true);
  });

  it('keeps every record uncommitted if any record or field is invalid', async () => {
    const before = readFileSync(join(directory, 'state.json'), 'utf8');
    await request(app).post('/api/logs/import').send({ text: JSON.stringify([log(), log({ sourceIp: '999.0.0.1' })]) }).expect(400);
    await request(app).post('/api/logs/import').send({ text: JSON.stringify([log({ origin: 'sample' })]) }).expect(400);
    await request(app).post('/api/logs/import').send({ text: JSON.stringify([log({ timestamp: 'yesterday' })]) }).expect(400);
    await request(app).post('/api/logs/import').send({ text: JSON.stringify([log({ timestamp: '2026-02-31T10:00:00.000Z' })]) }).expect(400);
    await request(app).post('/api/logs/import').send({ text: JSON.stringify([log({ vpn: 'true' })]) }).expect(400);
    expect(readFileSync(join(directory, 'state.json'), 'utf8')).toBe(before);
  });

  it('enforces record and payload limits', async () => {
    await request(app).post('/api/logs/import').send({ text: '[]' }).expect(400);
    await request(app).post('/api/logs/import').send({ text: JSON.stringify(Array.from({ length: 1001 }, () => log())) }).expect(400);
    await request(app).post('/api/logs/import').send({ text: 'a'.repeat(2 * 1024 * 1024 + 1) }).expect(400);
    await request(app).post('/api/logs/import').send({ text: 'a'.repeat(4 * 1024 * 1024) }).expect(413);
    expect(((await request(app).get('/api/state')).body as AppState).logs).toHaveLength(30);
  });
});

describe('safe lab, assessments, and reports', () => {
  it('enforces sequence, produces labeled evidence, and contains only synthetic lab alerts', async () => {
    await request(app).post('/api/lab/step').send({ stepId: 'lab-exploit' }).expect(409);
    const state = (await request(app).get('/api/state')).body as AppState;
    for (const step of state.lab.steps) {
      const response = await request(app).post('/api/lab/step').send({ stepId: step.id }).expect(200);
      expect(response.body.steps.find((entry: { id: string }) => entry.id === step.id).completed).toBe(true);
    }
    await request(app).post('/api/lab/step').send({ stepId: 'lab-report' }).expect(409);
    const after = (await request(app).get('/api/state')).body as AppState;
    expect(after.lab.stage).toBe(6); expect(after.logs.filter(entry => entry.origin === 'lab')).toHaveLength(6);
    expect(after.alerts.find(entry => entry.origin === 'lab')?.status).toBe('contained');
    expect(after.assets.map(asset => asset.status)).toEqual(state.assets.map(asset => asset.status));
    await request(app).post('/api/lab/reset').send({}).expect(200);
    const reset = (await request(app).get('/api/state')).body as AppState;
    expect(reset.lab.stage).toBe(0); expect(reset.logs.some(entry => entry.origin === 'lab')).toBe(false);
    expect(reset.actions.length).toBeGreaterThan(state.actions.length);
  });

  it('validates and persists self-reported NIST controls and quiz answers', async () => {
    const state = (await request(app).get('/api/state')).body as AppState;
    const control = state.nistControls[0];
    await request(app).post(`/api/nist/${control.id}`).send({ done: 'yes' }).expect(400);
    await request(app).post(`/api/nist/${control.id}`).send({ done: true }).expect(200);
    await request(app).post('/api/quiz').send({ answers: [0] }).expect(400);
    await request(app).post('/api/quiz').send({ answers: [0, 0, 0, 0, 99] }).expect(400);
    const result = await request(app).post('/api/quiz').send({ answers: quizQuestions.map(question => question.correct) }).expect(200);
    expect(result.body).toMatchObject({ score: 5, total: 5, correctAnswers: quizQuestions.map(question => question.correct) });
    expect(result.body.explanations).toHaveLength(5); expect(result.body.resultId).toBeTruthy();
    const after = (await request(app).get('/api/state')).body as AppState;
    expect(after.nistControls[0].done).toBe(true); expect(after.quizResults[0].id).toBe(result.body.resultId);
  });

  it('exports current data, creator attribution, mode, NIST mappings, and safe CSV text', async () => {
    await request(app).post('/api/logs/import').send({ text: JSON.stringify([log({ event: 'audit', message: '=IMPORTXML("https://example.com")' })]) }).expect(201);
    const report = await request(app).get('/api/report?format=json').expect(200);
    expect(report.body).toMatchObject({ creator: 'Vaibhav Thakur', mode: 'simulation', summary: { importedLogs: 1 } });
    expect(report.body.nistMapping).toHaveLength(12); expect(report.body.state.logs.some((entry: { origin: string }) => entry.origin === 'imported')).toBe(true);
    const markdown = await request(app).get('/api/report?format=md').expect(200);
    expect(markdown.text).toContain('Vaibhav Thakur'); expect(markdown.text).toContain('NIST CSF 2.0');
    const csv = await request(app).get('/api/report?format=csv').expect(200);
    expect(csv.text).toContain("'=IMPORTXML"); expect(csv.text).toContain('simulation');
    await request(app).get('/api/report?format=pdf').expect(400);
  });

  it('requires explicit reset confirmation before replacing local data', async () => {
    await request(app).post('/api/assets/ast-01/action').send({ action: 'isolate', reason: 'Training containment decision.' }).expect(200);
    await request(app).post('/api/demo/reset').send({ confirm: 'yes' }).expect(400);
    const result = await request(app).post('/api/demo/reset').send({ confirm: 'RESET' }).expect(200);
    expect(result.body.assets.find((asset: { id: string }) => asset.id === 'ast-01').status).toBe('online');
    expect(result.body.lab.stage).toBe(0);
  });
});

describe('actual bounded local TCP checks', () => {
  it('rejects arbitrary hosts, ports, and duplicate ports before making connections', async () => {
    for (const body of [{ host: 'example.com', ports: [9091] }, { host: '127.0.0.2', ports: [9091] }, { host: '127.0.0.1', ports: [22] }, { host: '127.0.0.1', ports: [9091, 9091] }, { host: '127.0.0.1', ports: [] }]) {
      await request(app).post('/api/scan').send(body).expect(400);
    }
    expect(((await request(app).get('/api/state')).body as AppState).scans).toHaveLength(0);
  });

  it('connects to its actual loopback lab listener and stores the observed scan', async () => {
    const temporary = createServer();
    await new Promise<void>(resolve => temporary.listen(0, '127.0.0.1', resolve));
    const address = temporary.address();
    if (!address || typeof address === 'string') throw new Error('Temporary port unavailable.');
    const labPort = address.port;
    await new Promise<void>(resolve => temporary.close(() => resolve()));
    await app.locals.close(); app = createApp({ dataDir: directory, labPort, startLab: true }); await app.locals.ready;
    const health = (await request(app).get('/api/health')).body;
    expect(health.lab.listeningPort).toBe(labPort);
    const response = await request(app).post('/api/scan').send({ host: '127.0.0.1', ports: [labPort, labPort + 1, labPort + 2] }).expect(200);
    expect(response.body.mode).toBe('local-lab'); expect(response.body.ports[0]).toMatchObject({ port: labPort, state: 'open', service: 'AEGIS HTTP training listener' });
    expect(response.body.ports.every((entry: { latencyMs: number }) => entry.latencyMs >= 0 && entry.latencyMs < 1000)).toBe(true);
    expect(((await request(app).get('/api/state')).body as AppState).scans[0].id).toBe(response.body.id);
    const listener = await fetch(`http://127.0.0.1:${labPort}`);
    expect(await listener.json()).toMatchObject({ mode: 'local-lab', scope: 'Loopback only. No shell or command execution.' });
  });
});
