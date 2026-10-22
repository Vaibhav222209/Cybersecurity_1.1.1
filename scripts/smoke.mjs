import assert from 'node:assert/strict';

const base = process.env.AEGIS_BASE_URL ?? 'http://127.0.0.1:5173';
const address = new URL(base);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname), 'Readiness checks must use the local application.');

async function request(path, json = true) {
  const response = await fetch(new URL(path, address), { signal: AbortSignal.timeout(8000) });
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return json ? response.json() : response.text();
}

const [health, state, report, html] = await Promise.all([
  request('/api/health'), request('/api/state'), request('/api/report?format=json'), request('/', false),
]);
assert.equal(health.status, 'ok');
assert.equal(health.mode, 'simulation');
assert.equal(health.lab.host, '127.0.0.1');
assert.equal(health.lab.ports.length, 3);
assert.equal(state.version, 1);
assert(Array.isArray(state.assets) && Array.isArray(state.logs), 'Workspace records are unavailable.');
assert.equal(state.nistControls.length, 12);
assert.equal(state.lab.steps.length, 6);
assert.equal(report.creator, 'Vaibhav Thakur');
assert.equal(report.mode, 'simulation');
assert.equal(report.summary.assets, state.assets.length);
assert.equal(report.summary.totalLogs, state.logs.length);
assert(html.includes('AEGIS — Cyber Operations by Vaibhav Thakur'), 'Frontend HTML is unavailable.');
assert(html.includes('/src/main.tsx') || html.includes('/assets/'), 'Frontend entry point is missing.');
console.log('AEGIS ready: frontend, local API, workspace, scoped lab configuration, and report generation verified.');
console.log('This read-only check did not reset or modify workspace data.');
