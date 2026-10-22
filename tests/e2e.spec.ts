import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { quizQuestions } from '../shared/quiz';
import type { AppState } from '../shared/types';

let pageErrors: string[] = [];

async function getState(page: Page): Promise<AppState> {
  const response = await page.request.get('/api/state');
  expect(response.ok()).toBe(true);
  return response.json();
}

async function navigate(page: Page, id: string) {
  await page.locator(`.sidebar a[href="#/${id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`#/${id}$`));
}

async function inspectAsset(page: Page, name = 'WEB-PROD-01') {
  await page.locator('.search-trigger').click();
  await page.getByLabel('Search assets, IPs, and pages').fill(name);
  await page.locator('.search-results button').filter({ hasText: name }).click();
  return page.getByRole('dialog', { name: 'Asset investigation' });
}

function failedLogins(ip = '198.51.100.201') {
  return Array.from({ length: 5 }, (_, index) => ({
    timestamp: new Date(Date.now() - (4 - index) * 60_000).toISOString(),
    severity: 'medium', sourceIp: ip, destinationIp: '10.24.1.10',
    event: 'failed_login', message: index === 0 ? '=2+2 imported authentication failure' : `Imported authentication failure ${index + 1}`,
    assetId: 'ast-01', protocol: 'TCP', port: 22, vpn: false,
  }));
}

test.beforeEach(async ({ page }) => {
  const health = await page.request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect((await health.json()).mode).toBe('simulation');
  const reset = await page.request.post('/api/demo/reset', { data: { confirm: 'RESET' } });
  expect(reset.ok()).toBe(true);
  pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.overview-page')).toBeVisible();
});

test.afterEach(() => {
  expect(pageErrors, 'The browser should not have unhandled application errors').toEqual([]);
});

test('every operations area renders, global search opens a real asset, and unmatched searches are clear', async ({ page }) => {
  await expect(page).toHaveTitle(/AEGIS.*Vaibhav Thakur/);
  await expect(page.locator('.creator-credit')).toContainText('Vaibhav Thakur');
  await expect(page.locator('.simulation-label')).toContainText('SIMULATION MODE');
  const pages = [
    ['intelligence', 'Threat intelligence'], ['assets', 'Assets & endpoints'], ['network', 'Network & TCP'],
    ['logs', 'Logs & events'], ['recon', 'Reconnaissance'], ['lab', 'Attack simulation lab'],
    ['response', 'Containment & firewall'], ['reports', 'Incident reports'], ['nist', 'NIST CSF 2.0'],
    ['quiz', 'Test your cyber instincts'],
  ];
  for (const [id, title] of pages) {
    await navigate(page, id);
    await expect(page.locator('.page-header h1')).toContainText(title);
    await expect(page.locator('main .page-title')).toBeVisible();
  }
  const dialog = await inspectAsset(page);
  await expect(dialog).toContainText('10.24.1.10');
  await expect(dialog).toContainText('Ubuntu');
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  await page.getByLabel('Search assets, IPs, and pages').fill('no-such-indicator-49371');
  await expect(page.getByRole('heading', { name: 'No signals found.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('asset containment requires evidence, persists after reload, and records release in the audit', async ({ page }) => {
  let dialog = await inspectAsset(page);
  await expect(dialog.getByRole('button', { name: 'Isolate asset', exact: true })).toBeDisabled();
  await dialog.getByLabel('Investigation note').fill('Unexpected process beacon observed; preserve evidence for review.');
  await dialog.getByRole('button', { name: 'Isolate asset', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Release asset', exact: true })).toBeVisible();
  let state = await getState(page);
  expect(state.assets.find(asset => asset.id === 'ast-01')?.status).toBe('isolated');
  expect(state.actions.some(action => action.action === 'isolate asset' && action.target === 'ast-01')).toBe(true);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  dialog = await inspectAsset(page);
  await expect(dialog.getByRole('button', { name: 'Release asset', exact: true })).toBeVisible();
  await dialog.getByLabel('Investigation note').fill('Investigation completed; simulated recovery criteria verified.');
  await dialog.getByRole('button', { name: 'Release asset', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Isolate asset', exact: true })).toBeVisible();
  state = await getState(page);
  expect(state.assets.find(asset => asset.id === 'ast-01')?.status).toBe('online');
  expect(state.actions.some(action => action.action === 'release asset')).toBe(true);
});

test('IP investigation correlates sources, watchlist updates persist, and phishing input never leaves the browser', async ({ page }) => {
  await navigate(page, 'intelligence');
  await page.getByLabel('IP address to investigate').fill('999.1.2.3');
  await page.getByRole('button', { name: 'Investigate', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('IP address to investigate').fill('198.51.100.201');
  await page.getByRole('button', { name: 'Investigate', exact: true }).click();
  await expect(page.locator('.mon-ip-result')).toContainText('reserved');
  await page.getByRole('button', { name: 'Add to watchlist' }).click();
  await expect(page.getByRole('button', { name: 'Watching', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.mon-watchlist-items')).toContainText('198.51.100.201');
  await page.getByRole('button', { name: 'Remove 198.51.100.201 from watchlist' }).click();
  await expect(page.locator('.mon-watchlist-items')).not.toContainText('198.51.100.201');
  await page.getByLabel('IP address to investigate').fill('2001:0db8:0000:0000:0000:0000:0000:0042');
  await page.getByRole('button', { name: 'Investigate', exact: true }).click();
  await expect(page.locator('.mon-ip-result')).toContainText('IPv6');
  await page.getByRole('button', { name: 'Add to watchlist' }).click();
  await expect(page.getByRole('button', { name: 'Watching', exact: true })).toBeVisible();
  expect((await getState(page)).watchlist).toContain('2001:db8::42');
  const duplicate = await page.request.post('/api/watchlist', { data: { ip: '2001:db8:0:0:0:0:0:42' } });
  expect(duplicate.status()).toBe(409);
  await page.reload();
  await expect(page.locator('.mon-watchlist-items')).toContainText('2001:db8::42');
  await page.getByRole('button', { name: 'Remove 2001:db8::42 from watchlist' }).click();
  await expect(page.locator('.mon-watchlist-items')).not.toContainText('2001:db8::42');
  const externalRequests: string[] = [];
  page.on('request', request => { if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) externalRequests.push(request.url()); });
  const suspicious = 'URGENT: verify your password immediately or your account will be suspended. http://bank.example@203.0.113.55/login';
  await page.getByLabel('EMAIL CONTENT OR URL', { exact: true }).fill(suspicious);
  await page.getByRole('button', { name: 'Analyze content' }).click();
  await expect(page.locator('.mon-analysis')).toContainText('High suspicion');
  await expect(page.locator('.mon-signal')).not.toHaveCount(0);
  expect(externalRequests).toEqual([]);
  expect(JSON.stringify(await getState(page))).not.toContain(suspicious);
  await page.getByRole('button', { name: 'Inspect events', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'VPN event visibility' })).toBeVisible();
  await expect(page.getByText(/cannot reveal a user's underlying address/)).toBeVisible();
});

test('log imports reject invalid records, detect repeated logins, export safe filtered CSV, and update a paused stream', async ({ page }) => {
  await navigate(page, 'logs');
  await page.getByRole('button', { name: 'Import logs', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import security logs' });
  await dialog.getByLabel('JSON ARRAY OR ONE OBJECT PER LINE').fill('{"event":"failed_login"}');
  await dialog.getByRole('button', { name: 'Validate & import' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect((await getState(page)).logs.filter(log => log.origin === 'imported')).toHaveLength(0);
  const records = failedLogins();
  await dialog.getByLabel('Choose log file').setInputFiles({ name: 'evidence.jsonl', mimeType: 'application/x-ndjson', buffer: Buffer.from(records.map(record => JSON.stringify(record)).join('\n')) });
  await expect(dialog.getByLabel('JSON ARRAY OR ONE OBJECT PER LINE')).toHaveValue(/failed_login/);
  await dialog.getByRole('button', { name: 'Validate & import' }).click();
  await expect(dialog).toHaveCount(0);
  const state = await getState(page);
  expect(state.logs.filter(log => log.origin === 'imported')).toHaveLength(5);
  expect(state.alerts.some(alert => alert.origin === 'imported' && alert.sourceIp === '198.51.100.201')).toBe(true);
  await page.getByLabel('Filter source IP').fill('198.51.100.201');
  await page.getByLabel('Filter event type').selectOption('failed_login');
  await expect(page.locator('.mon-logs-table tbody tr')).toHaveCount(5);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv).toContain('imported');
  expect(csv).toContain("'=2+2 imported authentication failure");
  expect(csv).not.toContain('203.0.113.44');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('button', { name: 'Pause view', exact: true }).click();
  const added = { ...records[1], timestamp: new Date().toISOString(), event: 'analyst_observation', message: 'An event received while the view is paused.' };
  const imported = await page.request.post('/api/logs/import', { data: { text: JSON.stringify([added]) } });
  expect(imported.ok()).toBe(true);
  await expect(page.getByText('View paused. 1 new event received in the background.')).toBeVisible();
  await expect(page.locator('.mon-logs-table')).not.toContainText('An event received while the view is paused.');
  await page.getByRole('button', { name: 'Resume stream', exact: true }).click();
  await expect(page.locator('.mon-logs-table')).toContainText('An event received while the view is paused.');
});

test('local reconnaissance makes observable TCP checks and rejects external scope', async ({ page }) => {
  await navigate(page, 'recon');
  await expect(page.getByLabel('TARGET HOST')).toHaveValue('127.0.0.1');
  await page.getByRole('button', { name: 'Run local check', exact: true }).click();
  const openRow = page.locator('.ops-scan-output tbody tr').filter({ hasText: '9091' });
  await expect(openRow).toContainText('OPEN');
  await expect(page.locator('.ops-scan-output tbody tr')).toHaveCount(3);
  let state = await getState(page);
  expect(state.scans).toHaveLength(1);
  expect(state.scans[0].mode).toBe('local-lab');
  expect(state.scans[0].ports.find(port => port.port === 9091)?.state).toBe('open');
  const badHost = await page.request.post('/api/scan', { data: { host: '198.51.100.44', ports: [9091] } });
  expect(badHost.status()).toBe(400);
  const badPort = await page.request.post('/api/scan', { data: { host: '127.0.0.1', ports: [22] } });
  expect(badPort.status()).toBe(400);
  await page.reload();
  await expect(page.locator('.ops-scan-history tbody tr')).toHaveCount(1);
  state = await getState(page);
  expect(state.scans).toHaveLength(1);
});

test('the six-stage attack lab enforces ordering and produces labeled evidence and containment', async ({ page }) => {
  const skipped = await page.request.post('/api/lab/step', { data: { stepId: 'lab-c2' } });
  expect(skipped.status()).toBe(409);
  await navigate(page, 'lab');
  for (let step = 1; step <= 6; step += 1) {
    await page.getByRole('button', { name: 'Run training step', exact: true }).click();
    await expect.poll(async () => (await getState(page)).lab.stage).toBe(step);
    await expect(page.locator('.ops-lab-progress-count strong')).toContainText(String(step).padStart(2, '0'));
  }
  await expect(page.getByRole('heading', { name: 'Scenario complete. Keep the lessons.' })).toBeVisible();
  let state = await getState(page);
  expect(state.logs.filter(log => log.origin === 'lab')).toHaveLength(6);
  expect(state.alerts.find(alert => alert.origin === 'lab')?.status).toBe('contained');
  expect(state.lab.steps.every(step => step.completed && step.output?.length)).toBe(true);
  await page.getByRole('button', { name: 'Reset scenario', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset training steps', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  state = await getState(page);
  expect(state.lab.stage).toBe(0);
  expect(state.logs.filter(log => log.origin === 'lab')).toHaveLength(0);
  expect(state.actions.some(action => action.action === 'reset lab')).toBe(true);
});

test('firewall rules match CIDR flows, toggle correctly, and delete only after confirmation', async ({ page }) => {
  await navigate(page, 'response');
  await page.getByRole('button', { name: 'Evaluate flow', exact: true }).click();
  await expect(page.locator('.ops-evaluation-result')).toContainText('ALLOW');
  await page.getByRole('button', { name: 'Add rule', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a simulation rule' });
  await dialog.locator('#rule-name').fill('Allow evidence lab HTTPS');
  await dialog.locator('#rule-action').selectOption('allow');
  await dialog.locator('#rule-source').fill('198.51.100.0/24');
  await dialog.locator('#rule-destination').fill('10.24.1.10');
  await dialog.locator('#rule-port').fill('8443');
  await dialog.getByRole('button', { name: 'Create rule', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator('#policy-source').fill('198.51.100.77');
  await page.locator('#policy-port').fill('8443');
  await page.getByRole('button', { name: 'Evaluate flow', exact: true }).click();
  await expect(page.locator('.ops-evaluation-result')).toContainText('ALLOW');
  await expect(page.locator('.ops-evaluation-result')).toContainText('Allow evidence lab HTTPS');
  await page.locator('#policy-direction').selectOption('outbound');
  await expect(page.locator('.ops-evaluation-result')).toHaveCount(0);
  await page.getByRole('button', { name: 'Evaluate flow', exact: true }).click();
  await expect(page.locator('.ops-evaluation-result')).toContainText('DENY');
  await expect(page.locator('.ops-evaluation-result')).toContainText('Default policy');
  await page.locator('#policy-direction').selectOption('inbound');
  await page.getByRole('button', { name: 'Evaluate flow', exact: true }).click();
  await expect(page.locator('.ops-evaluation-result')).toContainText('ALLOW');
  await expect(page.locator('.ops-evaluation-result')).toContainText('Allow evidence lab HTTPS');
  const toggle = page.getByRole('checkbox', { name: 'Enable rule Allow evidence lab HTTPS', exact: true });
  await toggle.click();
  await expect.poll(async () => (await getState(page)).rules.find(rule => rule.name === 'Allow evidence lab HTTPS')?.enabled).toBe(false);
  await page.getByRole('button', { name: 'Evaluate flow', exact: true }).click();
  await expect(page.locator('.ops-evaluation-result')).toContainText('DENY');
  await expect(page.locator('.ops-evaluation-result')).toContainText('Default policy');
  await page.getByRole('button', { name: 'Delete rule Allow evidence lab HTTPS', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delete simulation rule?' }).getByRole('button', { name: 'Delete rule', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.ops-firewall-panel')).not.toContainText('Allow evidence lab HTTPS');
  expect((await getState(page)).rules).toHaveLength(4);
});

test('TCP handshake explorer distinguishes normal connection and retransmission', async ({ page }) => {
  await navigate(page, 'network');
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Next packet', exact: true }).click();
  await expect(page.locator('.ops-net-handshake-status')).toContainText('Connection established');
  await expect(page.locator('.ops-net-handshake-status')).toContainText('03 / 03');
  await page.getByLabel('Handshake scenario').selectOption('retransmission');
  await expect(page.locator('.ops-net-handshake-status')).toContainText('Ready to trace a connection');
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Next packet', exact: true }).click();
  await expect(page.locator('.ops-net-handshake-status')).toContainText('SYN · retry');
  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Next packet', exact: true }).click();
  await expect(page.locator('.ops-net-handshake-status')).toContainText('05 / 05');
  await page.getByLabel('Filter network protocol').selectOption('TCP');
  const count = await page.locator('.ops-net-events tbody tr').count();
  expect(count).toBeGreaterThan(0);
  await page.getByLabel('Search network events').fill('absent-connection-49371');
  await expect(page.getByText('No matching network events', { exact: true })).toBeVisible();
});

test('incident exports contain current evidence, NIST mapping, creator attribution, and simulation scope', async ({ page }) => {
  await page.request.post('/api/assets/ast-01/action', { data: { action: 'investigate', reason: 'Reporting regression test evidence.' } });
  await navigate(page, 'reports');
  for (const [label, extension] of [['JSON', 'json'], ['Markdown', 'md'], ['CSV', 'csv']]) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Export ${label}`, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(`aegis-incident-report.${extension}`);
    const content = await readFile((await download.path())!, 'utf8');
    expect(content).toContain('Vaibhav Thakur');
    expect(content).toContain('simulation');
    expect(content.replaceAll('\\', '')).toContain('Reporting regression test evidence.');
    if (extension === 'json') {
      const report = JSON.parse(content);
      expect(report.creator).toBe('Vaibhav Thakur');
      expect(report.state.assets.find((asset: { id: string }) => asset.id === 'ast-01').status).toBe('investigating');
      expect(report.nistMapping).toHaveLength(12);
    }
  }
});

test('NIST review controls persist, expose all six functions, and retain self-assessment language', async ({ page }) => {
  await navigate(page, 'nist');
  await expect(page.getByRole('tab')).toHaveCount(6);
  const control = page.getByRole('checkbox', { name: /Mark GV.OC-01/ });
  await control.click();
  await expect.poll(async () => (await getState(page)).nistControls.find(item => item.id === 'GV.OC-01')?.done).toBe(true);
  await expect(control).toBeChecked();
  await page.reload();
  await expect(control).toBeChecked();
  expect((await getState(page)).nistControls.find(item => item.id === 'GV.OC-01')?.done).toBe(true);
  await page.getByRole('tab', { name: /Recover/ }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  await page.getByRole('button', { name: 'About this mapping' }).click();
  await expect(page.getByRole('dialog')).toContainText('does not implement the entire CSF');
  await page.keyboard.press('Escape');
});

test('five-question knowledge check uses the server score, saves attempts, and resets for a retry', async ({ page }) => {
  await navigate(page, 'quiz');
  await expect(page.getByRole('button', { name: 'Next question', exact: true })).toBeDisabled();
  for (let i = 0; i < quizQuestions.length; i += 1) {
    const question = quizQuestions[i];
    await page.getByRole('radio').nth(question.correct).check();
    await page.getByRole('button', { name: i < quizQuestions.length - 1 ? 'Next question' : 'Submit answers', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Sharp instincts. Solid foundations.' })).toBeVisible();
  await expect(page.locator('.quiz-result-score strong')).toHaveText('5/5');
  await expect(page.locator('.quiz-review-card')).toHaveCount(5);
  let state = await getState(page);
  expect(state.quizResults).toHaveLength(1);
  expect(state.quizResults[0].score).toBe(5);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next question', exact: true })).toBeDisabled();
  for (let i = 0; i < quizQuestions.length; i += 1) {
    const question = quizQuestions[i];
    await page.getByRole('radio').nth((question.correct + 1) % question.options.length).check();
    await page.getByRole('button', { name: i < quizQuestions.length - 1 ? 'Next question' : 'Submit answers', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Every question builds awareness.' })).toBeVisible();
  await expect(page.locator('.quiz-result-score strong')).toHaveText('0/5');
  state = await getState(page);
  expect(state.quizResults).toHaveLength(2);
  expect(state.quizResults.map(result => result.score).sort()).toEqual([0, 5]);
  await page.reload();
  await expect(page.locator('.quiz-stat').filter({ hasText: 'Your best score' })).toContainText('100%');
  await expect(page.locator('.quiz-stat').filter({ has: page.getByText('Saved attempts', { exact: true }) })).toContainText('2');
  await expect(page.getByRole('radio').first()).not.toBeChecked();
  state = await getState(page);
  expect(state.quizResults.every(result => result.total === 5)).toBe(true);
});

test('every operations area and modal fit 390px and 320px without horizontal document overflow', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.locator('.overview-page')).toBeVisible();
    await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
    await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await expect(page.locator('.sidebar')).not.toHaveAttribute('inert', '');
    await navigate(page, 'response');
    await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
    await page.getByRole('button', { name: 'Add rule', exact: true }).click();
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.width).toBeLessThanOrEqual(width);
    const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth, offenders: [...document.querySelectorAll('body *')].filter(element => { const box = element.getBoundingClientRect(); return box.right > window.innerWidth + 1 && box.left >= 0; }).slice(0, 12).map(element => ({ tag: element.tagName, cls: element.className, right: element.getBoundingClientRect().right })) }));
    expect(layout.scroll, JSON.stringify(layout)).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await navigate(page, 'quiz');
    await expect(page.getByRole('radio')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    for (const area of ['intelligence', 'assets', 'network', 'logs', 'recon', 'lab', 'reports', 'nist']) {
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await navigate(page, area);
      await expect(page.locator('main .page-title')).toBeVisible();
      const areaLayout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
      expect(areaLayout.scroll, `${area} at ${width}px: ${JSON.stringify(areaLayout)}`).toBeLessThanOrEqual(width + 1);
    }
  }
});
