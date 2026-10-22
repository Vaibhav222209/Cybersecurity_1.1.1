export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Origin = 'sample' | 'imported' | 'lab';
export type Page = 'overview' | 'intelligence' | 'assets' | 'network' | 'logs' | 'recon' | 'lab' | 'response' | 'reports' | 'nist' | 'quiz';

export interface Asset {
  id: string; name: string; ip: string; kind: 'server' | 'workstation' | 'gateway'; os: string;
  zone: string; status: 'online' | 'isolated' | 'investigating'; risk: number; lastSeen: string;
  owner: string; services: { port: number; protocol: string; service: string }[]; tags: string[]; origin: Origin;
}
export interface ThreatAlert {
  id: string; title: string; severity: Severity; status: 'open' | 'investigating' | 'contained' | 'resolved';
  category: 'Network' | 'Endpoint' | 'VPN' | 'Phishing' | 'Authentication'; sourceIp: string; targetId: string;
  timestamp: string; description: string; evidence: string[]; nist: string; origin: Origin;
}
export interface LogEvent {
  id: string; timestamp: string; severity: Severity; sourceIp: string; destinationIp: string;
  event: string; message: string; assetId?: string; protocol?: string; port?: number; vpn?: boolean; origin: Origin;
}
export interface FirewallRule {
  id: string; name: string; direction: 'inbound' | 'outbound'; action: 'allow' | 'deny';
  source: string; destination: string; protocol: 'TCP' | 'UDP' | 'ANY'; port: number | null; enabled: boolean; createdAt: string;
}
export interface CaseAction {
  id: string; timestamp: string; actor: string; action: string; target: string; reason: string; result: string;
  mode: 'simulation' | 'lab' | 'imported';
}
export interface ScanResult {
  id: string; host: string; startedAt: string; finishedAt: string; mode: 'local-lab';
  ports: { port: number; state: 'open' | 'closed' | 'filtered'; service: string; latencyMs: number }[];
}
export interface LabStep {
  id: string; title: string; description: string; mitre: string; completed: boolean; output?: string[]; timestamp?: string;
}
export interface LabState { stage: number; steps: LabStep[]; }
export interface QuizResult { id: string; score: number; total: number; answers: number[]; timestamp: string; }
export type NistFunction = 'Govern' | 'Identify' | 'Protect' | 'Detect' | 'Respond' | 'Recover';
export interface NistControl { id: string; function: NistFunction; title: string; description: string; done: boolean; category: string; }
export interface AppState {
  version: 1; mode: 'simulation'; updatedAt: string; assets: Asset[]; alerts: ThreatAlert[]; logs: LogEvent[];
  rules: FirewallRule[]; actions: CaseAction[]; scans: ScanResult[]; lab: LabState; quizResults: QuizResult[];
  nistControls: NistControl[]; watchlist: string[];
}
export interface FirewallEvaluation { action: 'allow' | 'deny'; matchedRule: FirewallRule | null; explanation: string; mode: 'simulation'; }
export interface Health { status: 'ok'; mode: 'simulation'; version: string; lab: { host: string; ports: number[]; listeningPort: number }; }
export interface QuizQuestion { id: string; question: string; options: string[]; correct: number; explanation: string; topic: string; }
