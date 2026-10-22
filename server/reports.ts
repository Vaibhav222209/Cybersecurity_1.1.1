import type { AppState } from '../shared/types.js';

export function createReport(state: AppState) {
  return {
    title: 'AEGIS Operations Report', creator: 'Vaibhav Thakur', generatedAt: new Date().toISOString(), mode: 'simulation',
    scope: 'Local training console. Sample, imported, and lab evidence are labeled by origin. Asset containment and firewall changes affect the model only.',
    summary: { assets: state.assets.length, openAlerts: state.alerts.filter(alert => !['contained', 'resolved'].includes(alert.status)).length,
      importedLogs: state.logs.filter(log => log.origin === 'imported').length, totalLogs: state.logs.length,
      completedControls: state.nistControls.filter(control => control.done).length, controls: state.nistControls.length,
      labStepsCompleted: state.lab.stage, recordedScans: state.scans.length },
    nistMapping: state.nistControls.map(control => ({ id: control.id, function: control.function, title: control.title, done: control.done })),
    state,
  };
}

const md = (value: unknown) => String(value ?? '').replace(/([\\`*_{}\[\]()#+.!|<>])/g, '\\$1').replace(/[\r\n]+/g, ' ');

export function markdownReport(state: AppState): string {
  const report = createReport(state);
  return [
    '# AEGIS Operations Report', '', '**Creator:** Vaibhav Thakur', `**Generated:** ${report.generatedAt}`,
    '**Mode:** simulation', '', report.scope, '',
    '## Current posture', '', `- Assets: ${report.summary.assets}`, `- Open or investigating alerts: ${report.summary.openAlerts}`,
    `- Logs: ${report.summary.totalLogs} (${report.summary.importedLogs} imported)`,
    `- NIST CSF 2.0 controls marked complete: ${report.summary.completedControls}/${report.summary.controls}`,
    `- Lab stages completed: ${state.lab.stage}/${state.lab.steps.length}`, '',
    '## Assets', '', '| Name | Address | Status | Origin |', '| --- | --- | --- | --- |',
    ...state.assets.map(asset => `| ${md(asset.name)} | ${md(asset.ip)} | ${md(asset.status)} | ${md(asset.origin)} |`), '',
    '## Alerts and NIST mapping', '', '| Alert | Severity | Status | Source | NIST | Origin |', '| --- | --- | --- | --- | --- | --- |',
    ...state.alerts.map(alert => `| ${md(alert.title)} | ${md(alert.severity)} | ${md(alert.status)} | ${md(alert.sourceIp)} | ${md(alert.nist)} | ${md(alert.origin)} |`), '',
    '## Firewall model', '', '| Rule | Direction | Action | Source | Destination | Protocol | Port | Enabled |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...state.rules.map(rule => `| ${md(rule.name)} | ${rule.direction} | ${rule.action} | ${md(rule.source)} | ${md(rule.destination)} | ${rule.protocol} | ${rule.port ?? 'any'} | ${rule.enabled} |`), '',
    '## NIST CSF 2.0 checklist', '', '| Control | Function | Description | Complete |', '| --- | --- | --- | --- |',
    ...state.nistControls.map(control => `| ${md(control.id)} | ${control.function} | ${md(control.title)} | ${control.done} |`), '',
    '## Action audit', '', '| Timestamp | Action | Target | Reason | Mode | Result |', '| --- | --- | --- | --- | --- | --- |',
    ...state.actions.map(action => `| ${md(action.timestamp)} | ${md(action.action)} | ${md(action.target)} | ${md(action.reason)} | ${action.mode} | ${md(action.result)} |`), '',
    '## Logs', '', '| Timestamp | Event | Source | Destination | Origin | Message |', '| --- | --- | --- | --- | --- | --- |',
    ...state.logs.map(log => `| ${md(log.timestamp)} | ${md(log.event)} | ${md(log.sourceIp)} | ${md(log.destinationIp)} | ${log.origin} | ${md(log.message)} |`), '',
    '## Local-lab scans', '', ...state.scans.map(scan => `- ${md(scan.finishedAt)}: ${md(scan.host)} — ${scan.ports.map(entry => `${entry.port}/${entry.state}`).join(', ')}`), '',
    'This report records the current local model. Self-reported controls and imported event labels are not independently verified.', '',
  ].join('\n');
}

function cell(value: unknown): string {
  let result = String(value ?? '');
  // Keep imported text from becoming a spreadsheet formula on opening the CSV.
  if (/^[\s]*[=+@-]/.test(result) || /^[\t\r]/.test(result)) result = `'${result}`;
  return `"${result.replaceAll('"', '""')}"`;
}

export function csvReport(state: AppState): string {
  const rows: unknown[][] = [['record_type', 'id', 'timestamp', 'name_or_event', 'severity_or_status', 'source', 'target', 'nist', 'origin_or_mode', 'detail'],
    ['metadata', '', new Date().toISOString(), 'AEGIS Operations Report', '', '', '', '', 'simulation', 'Creator: Vaibhav Thakur']];
  for (const asset of state.assets) rows.push(['asset', asset.id, asset.lastSeen, asset.name, asset.status, asset.ip, asset.zone, '', asset.origin, asset.os]);
  for (const alert of state.alerts) rows.push(['alert', alert.id, alert.timestamp, alert.title, `${alert.severity}/${alert.status}`, alert.sourceIp, alert.targetId, alert.nist, alert.origin, alert.description]);
  for (const log of state.logs) rows.push(['log', log.id, log.timestamp, log.event, log.severity, log.sourceIp, log.destinationIp, '', log.origin, log.message]);
  for (const rule of state.rules) rows.push(['rule', rule.id, rule.createdAt, rule.name, `${rule.action}/${rule.enabled ? 'enabled' : 'disabled'}`, rule.source, rule.destination, '', 'simulation', `${rule.direction} ${rule.protocol}/${rule.port ?? 'any'}`]);
  for (const action of state.actions) rows.push(['action', action.id, action.timestamp, action.action, action.result, action.actor, action.target, '', action.mode, action.reason]);
  for (const control of state.nistControls) rows.push(['nist', control.id, '', control.title, control.done ? 'complete' : 'pending', control.function, '', control.id, 'simulation', control.description]);
  for (const scan of state.scans) rows.push(['scan', scan.id, scan.finishedAt, 'Local TCP connect scan', '', scan.host, scan.ports.map(entry => `${entry.port}/${entry.state}`).join(';'), '', scan.mode, 'Actual bounded TCP connections to the local training listener only.']);
  for (const result of state.quizResults) rows.push(['quiz', result.id, result.timestamp, 'Knowledge check', `${result.score}/${result.total}`, '', '', '', 'simulation', 'Local practice result.']);
  return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
