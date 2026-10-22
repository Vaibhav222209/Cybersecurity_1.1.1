import { randomUUID } from 'node:crypto';
import type { AppState, LogEvent, ThreatAlert } from '../shared/types.js';
import { ApiError, boolean, enumValue, fields, ipv4, object, port, text } from './validation.js';

export function parseImportedLogs(input: unknown, state: AppState): LogEvent[] {
  if (typeof input !== 'string' || !input.trim() || Buffer.byteLength(input, 'utf8') > 2 * 1024 * 1024) {
    throw new ApiError(400, 'text must contain JSON or JSONL logs, up to 2 MiB.');
  }
  let records: unknown[];
  try {
    const value = input.trim();
    if (value.startsWith('[')) {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error('Not an array');
      records = parsed;
    } else records = value.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  } catch { throw new ApiError(400, 'Logs must be a valid JSON array or one complete JSON object per line (JSONL).'); }
  if (records.length < 1 || records.length > 1000) throw new ApiError(400, 'Import between 1 and 1,000 records at a time.');

  return records.map((record, index) => {
    try {
      const row = object(record);
      fields(row, ['timestamp', 'severity', 'sourceIp', 'destinationIp', 'event', 'message', 'assetId', 'protocol', 'port', 'vpn']);
      const timestamp = text(row.timestamp, 'timestamp', 20, 40);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) {
        throw new ApiError(400, 'timestamp must be an ISO-8601 date with a timezone.');
      }
      const [year, month, day] = timestamp.slice(0, 10).split('-').map(Number);
      const leap = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
      const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new ApiError(400, 'timestamp must contain a valid calendar date.');
      const event = text(row.event, 'event', 1, 80);
      if (!/^[A-Za-z0-9_.:-]+$/.test(event)) throw new ApiError(400, 'event must be an identifier using letters, numbers, dots, underscores, colons, or hyphens.');
      const result: LogEvent = {
        id: randomUUID(), timestamp: new Date(timestamp).toISOString(),
        severity: enumValue(row.severity, 'severity', ['critical', 'high', 'medium', 'low', 'info']),
        sourceIp: ipv4(row.sourceIp, 'sourceIp'), destinationIp: ipv4(row.destinationIp, 'destinationIp'),
        event, message: text(row.message, 'message', 1, 2000), origin: 'imported',
      };
      if (row.assetId !== undefined) {
        result.assetId = text(row.assetId, 'assetId', 1, 80);
        if (!state.assets.some(asset => asset.id === result.assetId)) throw new ApiError(400, 'assetId must identify an existing asset.');
      } else result.assetId = state.assets.find(asset => asset.ip === result.destinationIp || asset.ip === result.sourceIp)?.id;
      if (row.protocol !== undefined) {
        result.protocol = text(row.protocol, 'protocol', 1, 16).toUpperCase();
        if (!/^[A-Z0-9-]+$/.test(result.protocol)) throw new ApiError(400, 'protocol must use letters, numbers, or hyphens.');
      }
      if (row.port !== undefined) result.port = port(row.port);
      if (row.vpn !== undefined) result.vpn = boolean(row.vpn, 'vpn');
      return result;
    } catch (error) {
      if (error instanceof ApiError) throw new ApiError(400, `Record ${index + 1}: ${error.message}`);
      throw error;
    }
  });
}

export function detectImportedAlerts(state: AppState, incoming: LogEvent[]): ThreatAlert[] {
  const detected: ThreatAlert[] = [];
  const all = [...state.logs.filter(log => log.origin === 'imported'), ...incoming];
  const freshIds = new Set(incoming.map(log => log.id));
  const existing = [...state.alerts];

  function alert(code: string, log: LogEvent, values: Pick<ThreatAlert, 'title' | 'severity' | 'category' | 'description' | 'nist'>, evidence: string[]) {
    const marker = `Detection rule: ${code}`;
    const duplicate = [...existing, ...detected].some(previous => previous.origin === 'imported'
      && previous.sourceIp === log.sourceIp && previous.evidence.includes(marker)
      && Math.abs(Date.parse(previous.timestamp) - Date.parse(log.timestamp)) <= 10 * 60_000);
    if (duplicate) return;
    detected.push({ id: randomUUID(), ...values, status: 'open', sourceIp: log.sourceIp,
      targetId: log.assetId ?? '', timestamp: log.timestamp, origin: 'imported', evidence: [marker, ...evidence] });
  }

  const failures = new Map<string, LogEvent[]>();
  for (const log of all) {
    if (!['failed_login', 'login_failed', 'authentication_failed'].includes(log.event.toLowerCase())) continue;
    const group = failures.get(log.sourceIp) ?? [];
    group.push(log); failures.set(log.sourceIp, group);
  }
  for (const group of failures.values()) {
    group.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
    let start = 0; let freshCount = 0;
    for (let end = 0; end < group.length; end++) {
      if (freshIds.has(group[end].id)) freshCount++;
      while (Date.parse(group[end].timestamp) - Date.parse(group[start].timestamp) > 10 * 60_000) {
        if (freshIds.has(group[start].id)) freshCount--;
        start++;
      }
      if (end - start + 1 >= 5 && freshCount > 0) {
        alert('auth.failed-login-burst', group[end], {
          title: 'Repeated authentication failures', severity: 'high', category: 'Authentication', nist: 'DE.CM-03',
          description: 'At least five failed logins from the same IP occurred within ten minutes. This rule identifies a pattern, not a confirmed compromise.',
        }, [`${end - start + 1} failures in a ten-minute window.`, `Window: ${group[start].timestamp} to ${group[end].timestamp}.`]);
      }
    }
  }
  for (const log of incoming) {
    if (log.vpn && (['critical', 'high'].includes(log.severity) || /suspicious|anomal|impossible|unrecognized|unusual/i.test(`${log.event} ${log.message}`))) {
      alert('vpn.flagged-session', log, { title: 'Flagged VPN session', severity: 'medium', category: 'VPN', nist: 'DE.CM-01',
        description: 'An imported VPN event carries a high severity or explicit anomaly wording. Verify it against trusted authentication and location records.' }, [log.event, log.message]);
    }
    if (state.watchlist.includes(log.sourceIp)) {
      alert('network.watchlist-match', log, { title: 'Watchlist IP observed', severity: 'medium', category: 'Network', nist: 'DE.CM-01',
        description: 'An imported event matches an IP on your local watchlist. Membership is user-defined and does not establish malicious activity.' }, [log.event, `Source matched local watchlist: ${log.sourceIp}.`]);
    }
    if (['malware_detected', 'suspicious_process'].includes(log.event.toLowerCase())) {
      alert('endpoint.flagged-event', log, { title: 'Endpoint event requires review', severity: 'high', category: 'Endpoint', nist: 'DE.AE-02',
        description: 'An imported endpoint event was explicitly labeled malware_detected or suspicious_process. Review original evidence before taking action.' }, [log.event, log.message]);
    }
  }
  return detected;
}
