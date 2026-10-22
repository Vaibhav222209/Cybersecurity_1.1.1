import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'node:http';
import { Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { AppState, CaseAction, Health, LogEvent, ScanResult } from '../shared/types.js';
import { quizQuestions } from '../shared/quiz.js';
import { createSeedState } from '../shared/seed.js';
import { StateStore } from './store.js';
import { ApiError, boolean, enumValue, fields, ipAddress, ipv4, object, port, selector, text } from './validation.js';
import { evaluateFirewall } from './firewall.js';
import { detectImportedAlerts, parseImportedLogs } from './imports.js';
import { createReport, csvReport, markdownReport } from './reports.js';

export interface AppOptions { dataDir: string; labPort?: number; startLab?: boolean; staticDir?: string; }
export interface AegisApp extends Express {
  locals: Express['locals'] & { store: StateStore; ready: Promise<void>; close: () => Promise<void> };
}

const timestamp = () => new Date().toISOString();
const uuid = () => randomUUID();

function audit(state: AppState, action: string, target: string, reason: string, result: string, mode: CaseAction['mode'] = 'simulation') {
  state.actions.unshift({ id: uuid(), timestamp: timestamp(), actor: 'Local operator', action, target, reason, result, mode });
  state.actions = state.actions.slice(0, 500);
}

function idParam(req: Request, key = 'id'): string {
  const value = req.params[key];
  if (typeof value !== 'string') throw new ApiError(400, 'A single resource identifier is required.');
  return value;
}

export function createApp(options: AppOptions): AegisApp {
  const labPort = options.labPort ?? 9091;
  if (!Number.isInteger(labPort) || labPort < 1024 || labPort > 65533) throw new Error('LAB_PORT must be an integer from 1024 to 65533.');
  const allowedPorts = [labPort, labPort + 1, labPort + 2];
  const store = new StateStore(options.dataDir);
  const app = express() as AegisApp;
  app.locals.store = store;
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.get('sec-fetch-site') === 'cross-site') return next(new ApiError(403, 'Cross-site mutations are not allowed.'));
      const origin = req.get('origin');
      if (origin) {
        try {
          const parsed = new URL(origin);
          const sameHost = parsed.host === req.get('host');
          const localOrigin = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
          if (!['http:', 'https:'].includes(parsed.protocol) || (!sameHost && !localOrigin)) throw new Error('Untrusted origin');
        } catch { return next(new ApiError(403, 'Use the local application origin for changes.')); }
      }
    }
    next();
  });
  app.use(express.json({ limit: '3mb', strict: true }));

  const lab = options.startLab ? createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify({ service: 'AEGIS local training listener', mode: 'local-lab', scope: 'Loopback only. No shell or command execution.' }));
  }) : null;
  app.locals.ready = lab ? new Promise<void>((resolveReady, reject) => {
    lab.once('error', reject);
    lab.listen(labPort, '127.0.0.1', () => { lab.removeListener('error', reject); resolveReady(); });
  }) : Promise.resolve();

  const clients = new Set<Response>();
  const broadcast = (updatedAt: string) => {
    for (const client of clients) {
      try { client.write(`event: state\ndata: ${JSON.stringify({ updatedAt })}\n\n`); }
      catch { clients.delete(client); client.destroy(); }
    }
  };
  store.on('change', broadcast);
  const heartbeat = setInterval(() => { for (const client of clients) client.write(': heartbeat\n\n'); }, 15_000);
  heartbeat.unref();
  app.locals.close = async () => {
    clearInterval(heartbeat); store.removeListener('change', broadcast);
    for (const client of clients) client.end();
    clients.clear();
    if (lab?.listening) await new Promise<void>((resolveClosed, reject) => lab.close(error => error ? reject(error) : resolveClosed()));
  };

  app.get('/api/health', (_req, res) => {
    const health: Health = { status: 'ok', mode: 'simulation', version: '1.0.0', lab: { host: '127.0.0.1', ports: allowedPorts, listeningPort: lab?.listening ? labPort : 0 } };
    res.json(health);
  });
  app.get('/api/state', (_req, res) => { res.json(store.read()); });
  app.get('/api/events', (req, res) => {
    res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders(); clients.add(res);
    res.write(`event: ready\ndata: ${JSON.stringify({ updatedAt: store.read().updatedAt })}\n\n`);
    req.on('close', () => clients.delete(res));
    res.on('close', () => clients.delete(res));
    res.on('error', () => clients.delete(res));
  });

  app.post('/api/assets/:id/action', (req, res) => {
    const body = object(req.body); fields(body, ['action', 'reason']);
    const action = enumValue(body.action, 'action', ['isolate', 'release', 'investigate']);
    const reason = text(body.reason, 'reason', 5, 500);
    const result = store.update(state => {
      const asset = state.assets.find(entry => entry.id === idParam(req));
      if (!asset) throw new ApiError(404, 'Asset not found.');
      const investigationDuringIsolation = action === 'investigate' && asset.status === 'isolated';
      asset.status = action === 'isolate' ? 'isolated' : action === 'release' ? 'online' : investigationDuringIsolation ? 'isolated' : 'investigating';
      if (action === 'isolate') for (const alert of state.alerts) if (alert.targetId === asset.id && alert.status !== 'resolved') alert.status = 'contained';
      audit(state, `${action} asset`, asset.id, reason, `${investigationDuringIsolation ? 'Model remains isolated; investigation note recorded' : `Model status changed to ${asset.status}`}. No remote device or network was modified.`);
      return asset;
    });
    res.json(result);
  });

  app.post('/api/alerts/:id/status', (req, res) => {
    const body = object(req.body); fields(body, ['status']);
    const status = enumValue(body.status, 'status', ['open', 'investigating', 'contained', 'resolved']);
    const alert = store.update(state => {
      const found = state.alerts.find(entry => entry.id === idParam(req));
      if (!found) throw new ApiError(404, 'Alert not found.');
      found.status = status;
      audit(state, 'update alert', found.id, 'Operator updated the alert triage status.', `Alert marked ${status}; simulation record only.`);
      return found;
    });
    res.json(alert);
  });

  app.post('/api/firewall/rules', (req, res) => {
    const body = object(req.body); fields(body, ['name', 'direction', 'action', 'source', 'destination', 'protocol', 'port', 'enabled']);
    const rule = { id: uuid(), name: text(body.name, 'name', 3, 80), direction: enumValue(body.direction, 'direction', ['inbound', 'outbound']),
      action: enumValue(body.action, 'action', ['allow', 'deny']), source: selector(body.source), destination: selector(body.destination),
      protocol: enumValue(body.protocol, 'protocol', ['TCP', 'UDP', 'ANY']), port: body.port === null ? null : port(body.port),
      enabled: boolean(body.enabled, 'enabled'), createdAt: timestamp() };
    store.update(state => {
      if (state.rules.length >= 100) throw new ApiError(409, 'The local policy model supports at most 100 rules.');
      state.rules.push(rule); audit(state, 'add firewall rule', rule.id, `Added local policy model rule: ${rule.name}`, 'Simulation policy updated. No OS firewall changed.');
    });
    res.status(201).json(rule);
  });
  app.post('/api/firewall/rules/:id/toggle', (req, res) => {
    const body = object(req.body); fields(body, ['enabled']); const enabled = boolean(body.enabled, 'enabled');
    const rule = store.update(state => {
      const found = state.rules.find(entry => entry.id === idParam(req)); if (!found) throw new ApiError(404, 'Rule not found.');
      found.enabled = enabled; audit(state, 'toggle firewall rule', found.id, 'Operator changed the local policy model.', `Rule ${enabled ? 'enabled' : 'disabled'} in simulation.`); return found;
    }); res.json(rule);
  });
  app.delete('/api/firewall/rules/:id', (req, res) => {
    store.update(state => {
      const index = state.rules.findIndex(entry => entry.id === idParam(req)); if (index < 0) throw new ApiError(404, 'Rule not found.');
      state.rules.splice(index, 1); audit(state, 'delete firewall rule', idParam(req), 'Operator removed the local policy model rule.', 'Simulation policy updated.');
    }); res.status(204).end();
  });
  app.post('/api/firewall/evaluate', (req, res) => {
    const body = object(req.body); fields(body, ['source', 'destination', 'protocol', 'port', 'direction']);
    const packet = { source: ipv4(body.source, 'source'), destination: ipv4(body.destination, 'destination'),
      protocol: enumValue(body.protocol, 'protocol', ['TCP', 'UDP']), port: port(body.port),
      direction: body.direction === undefined ? 'inbound' as const : enumValue(body.direction, 'direction', ['inbound', 'outbound']) };
    res.json(evaluateFirewall(store.read().rules, packet));
  });

  let scanning = false;
  app.post('/api/scan', async (req, res, next) => {
    try {
      const body = object(req.body); fields(body, ['host', 'ports']);
      if (body.host !== '127.0.0.1') throw new ApiError(400, 'Only the fixed host 127.0.0.1 is allowed.');
      if (!Array.isArray(body.ports) || !body.ports.length || body.ports.length > 3
        || !body.ports.every(value => typeof value === 'number' && allowedPorts.includes(value))
        || new Set(body.ports).size !== body.ports.length) throw new ApiError(400, `Choose distinct local training ports: ${allowedPorts.join(', ')}.`);
      if (scanning) throw new ApiError(409, 'A local scan is already running.');
      scanning = true;
      try {
        const startedAt = timestamp();
        const ports = await Promise.all((body.ports as number[]).map(value => connectPort(value, lab?.listening ? labPort : null)));
        const result: ScanResult = { id: uuid(), host: '127.0.0.1', mode: 'local-lab', startedAt, finishedAt: timestamp(), ports };
        store.update(state => { state.scans.unshift(result); state.scans = state.scans.slice(0, 30);
          audit(state, 'local TCP scan', '127.0.0.1', 'Bounded TCP connect check of the configured local training ports.', `${ports.filter(entry => entry.state === 'open').length} open port(s). Real loopback connections only.`, 'lab'); });
        res.json(result);
      } finally { scanning = false; }
    } catch (error) { next(error); }
  });

  app.post('/api/lab/step', (req, res) => {
    const body = object(req.body); fields(body, ['stepId']); const stepId = text(body.stepId, 'stepId', 1, 80);
    const labState = store.update(state => {
      const stepIndex = state.lab.steps.findIndex(step => step.id === stepId);
      if (stepIndex < 0) throw new ApiError(404, 'Lab step not found.');
      if (stepIndex !== state.lab.stage || state.lab.steps[stepIndex].completed) throw new ApiError(409, 'Complete the next pending lab step in sequence.');
      const step = state.lab.steps[stepIndex]; const now = timestamp();
      step.completed = true; step.timestamp = now; step.output = labOutputs[stepId] ?? ['Training model advanced. No external command was executed.'];
      state.lab.stage++;
      const log: LogEvent = { id: uuid(), timestamp: now, severity: stepId === 'lab-c2' ? 'high' : 'info',
        sourceIp: '203.0.113.44', destinationIp: '10.24.2.18', event: stepId.replaceAll('-', '_'),
        message: `Lab model: ${step.title}. No exploit, shell, or payload executed.`, assetId: 'ast-03', origin: 'lab' };
      state.logs.unshift(log); state.logs = state.logs.slice(0, 2000);
      if (stepId === 'lab-c2') state.alerts.unshift({ id: uuid(), title: 'Lab: simulated command-and-control beacon', severity: 'high', status: 'open', category: 'Network',
        sourceIp: '203.0.113.44', targetId: 'ast-03', timestamp: now, description: 'A synthetic beacon event was inserted for analyst practice. No outbound connection or command channel exists.',
        evidence: ['Origin: local safe lab model', 'Synthetic periodic HTTPS beacon pattern', 'No external traffic generated'], nist: 'DE.CM-01', origin: 'lab' });
      if (stepId === 'lab-contain') for (const alert of state.alerts) if (alert.origin === 'lab') alert.status = 'contained';
      state.alerts = state.alerts.slice(0, 500);
      audit(state, `lab: ${step.title}`, step.id, 'Operator advanced the safe training sequence.', 'Model output recorded; no command or exploit executed.', 'lab');
      return state.lab;
    }); res.json(labState);
  });
  app.post('/api/lab/reset', (req, res) => {
    const body = object(req.body); fields(body, []);
    const labState = store.update(state => {
      state.lab = createSeedState().lab; state.logs = state.logs.filter(log => log.origin !== 'lab'); state.alerts = state.alerts.filter(alert => alert.origin !== 'lab');
      audit(state, 'reset lab', 'training sequence', 'Operator reset the local training scenario.', 'Lab sequence and synthetic lab indicators reset. Manual asset state, scans, and audit history retained.', 'lab');
      return state.lab;
    }); res.json(labState);
  });

  app.post('/api/logs/import', (req, res) => {
    const body = object(req.body); fields(body, ['text']);
    const current = store.read(); const logs = parseImportedLogs(body.text, current);
    const alerts = detectImportedAlerts(current, logs);
    store.update(state => {
      state.logs = [...logs, ...state.logs].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp)).slice(0, 2000);
      state.alerts = [...alerts, ...state.alerts].slice(0, 500);
      audit(state, 'import logs', `${logs.length} records`, 'Operator imported and validated local JSON/JSONL records.', `${logs.length} imported, ${alerts.length} rule-based alert(s) created.`, 'imported');
    });
    res.status(201).json({ imported: logs.length, alertsCreated: alerts.length });
  });
  app.post('/api/watchlist', (req, res) => {
    const body = object(req.body); fields(body, ['ip']); const ip = ipAddress(body.ip);
    store.update(state => {
      if (state.watchlist.some(value => ipAddress(value) === ip)) throw new ApiError(409, 'This IP is already on the local watchlist.');
      if (state.watchlist.length >= 100) throw new ApiError(409, 'The local watchlist supports at most 100 addresses.');
      state.watchlist.push(ip); audit(state, 'add watchlist IP', ip, 'Operator added an address for local log correlation.', 'Watchlist updated. No external reputation lookup was performed.');
    }); res.status(201).json({ ip });
  });
  app.delete('/api/watchlist/:ip', (req, res) => {
    const ip = ipAddress(idParam(req, 'ip'));
    store.update(state => {
      if (!state.watchlist.some(value => ipAddress(value) === ip)) throw new ApiError(404, 'IP not found on the watchlist.');
      state.watchlist = state.watchlist.filter(value => ipAddress(value) !== ip);
      audit(state, 'remove watchlist IP', ip, 'Operator removed a local correlation address.', 'Watchlist updated.');
    }); res.status(204).end();
  });

  app.post('/api/nist/:id', (req, res) => {
    const body = object(req.body); fields(body, ['done']); const done = boolean(body.done, 'done');
    const control = store.update(state => {
      const found = state.nistControls.find(entry => entry.id === idParam(req)); if (!found) throw new ApiError(404, 'Control not found.');
      found.done = done; audit(state, 'NIST checklist', found.id, 'Operator updated a self-reported readiness control.', `Marked ${done ? 'complete' : 'pending'}; not an independently verified assessment.`); return found;
    }); res.json(control);
  });
  app.post('/api/quiz', (req, res) => {
    const body = object(req.body); fields(body, ['answers']);
    if (!Array.isArray(body.answers) || body.answers.length !== quizQuestions.length
      || !body.answers.every((answer, index) => Number.isInteger(answer) && answer >= 0 && answer < quizQuestions[index].options.length)) {
      throw new ApiError(400, `Provide one valid answer index for each of the ${quizQuestions.length} questions.`);
    }
    const answers = body.answers as number[]; const score = answers.reduce((total, answer, index) => total + Number(answer === quizQuestions[index].correct), 0);
    const result = { id: uuid(), score, total: quizQuestions.length, answers, timestamp: timestamp() };
    store.update(state => { state.quizResults.unshift(result); state.quizResults = state.quizResults.slice(0, 100);
      audit(state, 'knowledge check', result.id, 'Operator completed the local practice quiz.', `${score}/${quizQuestions.length} correct.`); });
    res.json({ score, total: quizQuestions.length, correctAnswers: quizQuestions.map(question => question.correct), explanations: quizQuestions.map(question => question.explanation), resultId: result.id });
  });
  app.get('/api/report', (req, res) => {
    const format = req.query.format ?? 'json'; const state = store.read();
    if (format === 'json') res.attachment('aegis-report.json').json(createReport(state));
    else if (format === 'md') res.attachment('aegis-report.md').type('text/markdown').send(markdownReport(state));
    else if (format === 'csv') res.attachment('aegis-report.csv').type('text/csv').send(csvReport(state));
    else throw new ApiError(400, 'format must be json, md, or csv.');
  });
  app.post('/api/demo/reset', (req, res) => {
    const body = object(req.body); fields(body, ['confirm']);
    if (body.confirm !== 'RESET') throw new ApiError(400, 'Send confirm: RESET to replace local console data with the sample scenario.');
    if (scanning) throw new ApiError(409, 'Wait for the local scan to finish before resetting.');
    res.json(store.reset());
  });

  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'API route not found.')));
  const staticDirectory = options.staticDir ?? (process.env.NODE_ENV === 'production' ? resolve('dist') : undefined);
  if (staticDirectory && existsSync(staticDirectory)) {
    app.use(express.static(staticDirectory));
    app.get(/.*/, (_req, res) => { res.sendFile(resolve(staticDirectory, 'index.html')); });
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: error.message }); return; }
    const parserError = error as { type?: string };
    if (parserError?.type === 'entity.too.large') { res.status(413).json({ error: 'Request is too large. Import at most 2 MiB of log text.' }); return; }
    if (parserError?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Request body must be valid JSON.' }); return; }
    console.error('AEGIS request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ error: 'The operation could not be saved. Existing persisted data was preserved.' });
  });
  return app;
}

function connectPort(value: number, labPort: number | null): Promise<ScanResult['ports'][number]> {
  return new Promise(resolvePort => {
    const started = performance.now(); const socket = new Socket(); let settled = false;
    const finish = (state: 'open' | 'closed' | 'filtered') => {
      if (settled) return; settled = true; socket.destroy();
      resolvePort({ port: value, state, service: state === 'open' && value === labPort ? 'AEGIS HTTP training listener' : state === 'open' ? 'Local listener (unidentified)' : 'No responsive service', latencyMs: Math.round((performance.now() - started) * 100) / 100 });
    };
    socket.setTimeout(400); socket.once('connect', () => finish('open')); socket.once('timeout', () => finish('filtered'));
    socket.once('error', (error: NodeJS.ErrnoException) => finish(error.code === 'ECONNREFUSED' ? 'closed' : 'filtered'));
    socket.connect(value, '127.0.0.1');
  });
}

const labOutputs: Record<string, string[]> = {
  'lab-recon': ['Mapped the predefined training asset and known service inventory.', 'This stage reads the local model; use Local Recon for actual bounded loopback TCP checks.', 'MITRE ATT&CK T1046: Network Service Discovery (modeled).'],
  'lab-exploit': ['Modeled an initial-access finding against the predefined training target.', 'No vulnerability was exploited; no command, shell, or payload was run.', 'Evidence recorded as lab-origin telemetry.'],
  'lab-privilege': ['Modeled a privilege-boundary violation for analyst practice.', 'No account, user privilege, file permission, or operating-system setting changed.', 'Investigate privilege changes using trusted endpoint evidence in a real incident.'],
  'lab-c2': ['Inserted a synthetic periodic-beacon indicator and a lab-origin alert.', 'No command-and-control connection exists and no traffic left the machine.', 'Review the alert and its NIST Detect mapping.'],
  'lab-contain': ['Marked only the synthetic lab alert contained.', 'Manual asset states and operating-system networking remain unchanged.', 'In a real incident, preserve evidence and follow the approved containment plan.'],
  'lab-report': ['Training sequence complete. The action audit records each stage.', 'Export the current JSON, Markdown, or CSV report from Reports.', 'Report labels retain sample, imported, and lab origins; creator: Vaibhav Thakur.'],
};
