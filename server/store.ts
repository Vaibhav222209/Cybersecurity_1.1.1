import { EventEmitter } from 'node:events';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppState } from '../shared/types.js';
import { createSeedState } from '../shared/seed.js';
import { ipAddress, ipv4, selector } from './validation.js';

export class StateStore extends EventEmitter {
  private value: AppState;
  readonly path: string;

  constructor(dataDir: string) {
    super();
    const directory = resolve(dataDir);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.path = join(directory, 'state.json');
    if (existsSync(this.path)) {
      let parsed: unknown;
      try { parsed = JSON.parse(readFileSync(this.path, 'utf8')); }
      catch { throw new Error('AEGIS state cannot be read. Preserve state.json and restore a valid backup before restarting.'); }
      if (!isStoredState(parsed)) throw new Error('AEGIS state has an unsupported or invalid format. Preserve state.json before restoring a backup.');
      this.value = parsed;
    } else {
      this.value = createSeedState();
      this.persist(this.value);
    }
  }

  read(): AppState { return structuredClone(this.value); }

  update<T>(change: (draft: AppState) => T): T {
    const draft = this.read();
    const result = change(draft);
    draft.updatedAt = new Date().toISOString();
    this.persist(draft);
    this.value = draft;
    this.emit('change', draft.updatedAt);
    return result;
  }

  reset(): AppState {
    const next = createSeedState();
    this.persist(next);
    this.value = next;
    this.emit('change', next.updatedAt);
    return this.read();
  }

  private persist(state: AppState) {
    const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      renameSync(temporary, this.path);
    } catch (error) {
      if (existsSync(temporary)) unlinkSync(temporary);
      throw error;
    }
  }
}

function isStoredState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  const arrays = ['assets', 'alerts', 'logs', 'rules', 'actions', 'scans', 'quizResults', 'nistControls', 'watchlist'];
  if (state.version !== 1 || state.mode !== 'simulation' || typeof state.updatedAt !== 'string' || !Number.isFinite(Date.parse(state.updatedAt))) return false;
  if (!arrays.every(key => Array.isArray(state[key]))) return false;
  const every = (key: string, check: (entry: Record<string, unknown>) => boolean) => (state[key] as unknown[]).every(entry => isRecord(entry) && check(entry));
  const origin = (entry: Record<string, unknown>) => ['sample', 'imported', 'lab'].includes(String(entry.origin));
  const date = (entry: unknown) => typeof entry === 'string' && Number.isFinite(Date.parse(entry));
  const ip = (entry: unknown) => { try { ipv4(entry); return true; } catch { return false; } };
  const network = (entry: unknown) => { try { selector(entry); return true; } catch { return false; } };
  const strings = (entry: unknown) => Array.isArray(entry) && entry.every(item => typeof item === 'string');
  const isPort = (entry: unknown) => typeof entry === 'number' && Number.isInteger(entry) && entry >= 1 && entry <= 65535;
  const severity = (entry: unknown) => ['critical', 'high', 'medium', 'low', 'info'].includes(String(entry));
  if (!every('assets', entry => hasFields(entry, ['id', 'name', 'ip', 'status', 'kind', 'os', 'zone', 'owner'], ['services', 'tags'])
    && origin(entry) && ip(entry.ip) && date(entry.lastSeen) && strings(entry.tags)
    && ['server', 'workstation', 'gateway'].includes(String(entry.kind)) && ['online', 'isolated', 'investigating'].includes(String(entry.status))
    && typeof entry.risk === 'number' && entry.risk >= 0 && entry.risk <= 100
    && (entry.services as unknown[]).every(service => isRecord(service) && isPort(service.port) && hasFields(service, ['protocol', 'service'])))) return false;
  if (!every('alerts', entry => hasFields(entry, ['id', 'title', 'sourceIp', 'status', 'severity', 'category', 'targetId', 'description', 'nist'], ['evidence'])
    && origin(entry) && severity(entry.severity) && ip(entry.sourceIp) && date(entry.timestamp) && strings(entry.evidence)
    && ['open', 'investigating', 'contained', 'resolved'].includes(String(entry.status))
    && ['Network', 'Endpoint', 'VPN', 'Phishing', 'Authentication'].includes(String(entry.category)))) return false;
  if (!every('logs', entry => hasFields(entry, ['id', 'event', 'message', 'sourceIp', 'destinationIp', 'origin'])
    && origin(entry) && severity(entry.severity) && date(entry.timestamp) && ip(entry.sourceIp) && ip(entry.destinationIp)
    && (entry.port === undefined || isPort(entry.port)) && (entry.vpn === undefined || typeof entry.vpn === 'boolean')
    && (entry.assetId === undefined || typeof entry.assetId === 'string') && (entry.protocol === undefined || typeof entry.protocol === 'string'))) return false;
  if (!every('rules', entry => hasFields(entry, ['id', 'name', 'source', 'destination', 'action', 'protocol'])
    && network(entry.source) && network(entry.destination) && date(entry.createdAt) && typeof entry.enabled === 'boolean'
    && ['inbound', 'outbound'].includes(String(entry.direction)) && ['allow', 'deny'].includes(String(entry.action))
    && ['TCP', 'UDP', 'ANY'].includes(String(entry.protocol)) && (entry.port === null || isPort(entry.port)))) return false;
  if (!every('actions', entry => hasFields(entry, ['id', 'action', 'target', 'reason', 'actor', 'result'])
    && date(entry.timestamp) && ['simulation', 'lab', 'imported'].includes(String(entry.mode)))) return false;
  if (!every('scans', entry => hasFields(entry, ['id', 'host'], ['ports']) && entry.host === '127.0.0.1' && entry.mode === 'local-lab'
    && date(entry.startedAt) && date(entry.finishedAt) && (entry.ports as unknown[]).every(result => isRecord(result)
      && isPort(result.port) && ['open', 'closed', 'filtered'].includes(String(result.state)) && typeof result.service === 'string'
      && typeof result.latencyMs === 'number' && Number.isFinite(result.latencyMs) && result.latencyMs >= 0))) return false;
  if (!every('quizResults', entry => typeof entry.id === 'string' && date(entry.timestamp) && entry.total === 5
    && typeof entry.score === 'number' && Number.isInteger(entry.score) && entry.score >= 0 && entry.score <= 5
    && Array.isArray(entry.answers) && entry.answers.length === 5 && entry.answers.every(answer => Number.isInteger(answer) && answer >= 0 && answer < 4))) return false;
  if (!every('nistControls', entry => hasFields(entry, ['id', 'title', 'function', 'description', 'category'])
    && ['Govern', 'Identify', 'Protect', 'Detect', 'Respond', 'Recover'].includes(String(entry.function)) && typeof entry.done === 'boolean')) return false;
  if (!(state.watchlist as unknown[]).every(value => { try { ipAddress(value); return true; } catch { return false; } })) return false;
  const lab = state.lab as Record<string, unknown> | null;
  return !!lab && typeof lab === 'object' && typeof lab.stage === 'number' && Number.isInteger(lab.stage) && Array.isArray(lab.steps)
    && lab.stage >= 0 && lab.stage <= lab.steps.length && lab.steps.length === 6
    && lab.steps.every((entry, index) => isRecord(entry) && hasFields(entry, ['id', 'title', 'description', 'mitre'])
      && typeof entry.completed === 'boolean' && entry.completed === (index < Number(lab.stage))
      && (entry.output === undefined || strings(entry.output)) && (entry.timestamp === undefined || date(entry.timestamp)));
}

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }

function hasFields(value: unknown, strings: string[], arrays: string[] = []) {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return strings.every(key => typeof entry[key] === 'string') && arrays.every(key => Array.isArray(entry[key]));
}
