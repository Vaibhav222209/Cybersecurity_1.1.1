import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDownToLine, ArrowRight, Check, CheckCheck, ChevronRight, CircleAlert, CircleCheck,
  FileJson, FileText, Flag, Globe, History, Layers3, ListChecks, LoaderCircle,
  LockKeyhole, Monitor, Play, Plus, Radar, RotateCcw, Search, Server, Shield,
  ShieldAlert, ShieldCheck, ShieldOff, Terminal, Trash2, Workflow,
} from 'lucide-react';
import type { FirewallEvaluation, FirewallRule, PageProps, ScanResult } from '../types';
import { api, downloadText, errorMessage } from '../lib/api';
import Modal from './Modal';
import './Operations.css';

export { default as NetworkPage } from './operations/NetworkPage';

function timestamp(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(date)
    : '—';
}

function PageIntro({ label, title, description, children }: { label: string; title: string; description: string; children?: ReactNode }) {
  return <div className="ops-page-intro"><div><span className="ops-kicker">{label}</span><h2 className="page-title">{title}</h2><p>{description}</p></div>{children}</div>;
}

function ScopeNote({ children, tone = 'cyan' }: { children: ReactNode; tone?: 'cyan' | 'amber' }) {
  return <div className={`ops-scope-note ops-scope-${tone}`}><ShieldCheck size={17} /><span>{children}</span></div>;
}

function InlineError({ message }: { message: string }) {
  return message ? <p className="ops-error" role="alert"><CircleAlert size={16} />{message}</p> : null;
}

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: ReactNode }) {
  return <div className="ops-metric"><div><span>{label}</span>{icon}</div><strong>{value}</strong><small>{detail}</small></div>;
}

export function ReconPage({ state, refresh, notify }: PageProps) {
  const [ports, setPorts] = useState([9091, 9092, 9093]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const scans = useMemo(() => [...state.scans].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)), [state.scans]);
  const current = scans.find(scan => scan.id === selectedScanId) ?? scans[0];
  const openPorts = current?.ports.filter(port => port.state === 'open').length ?? 0;

  async function runScan() {
    setBusy(true); setError('');
    try {
      const result = await api<ScanResult>('/scan', { host: '127.0.0.1', ports });
      setSelectedScanId(result.id);
      await refresh();
      notify(`Local TCP check complete: ${result.ports.filter(port => port.state === 'open').length} open port(s).`);
    } catch (cause) { const message = errorMessage(cause); setError(message); notify(message, 'error'); }
    finally { setBusy(false); }
  }

  return <section className="ops-page">
    <PageIntro label="01 / LOCAL RECONNAISSANCE" title="Know the surface." description="Run a real TCP connection check against the workspace’s own lab services."><span className="ops-mode-badge"><span />LIVE LOCAL TCP</span></PageIntro>
    <ScopeNote>Scope enforced by the server: <strong>127.0.0.1</strong>, ports <strong>9091–9093</strong> only. External hosts and other ports are rejected.</ScopeNote>
    <div className="ops-metrics-row"><Metric label="ALLOWED TARGETS" value="01" detail="Loopback interface only" icon={<Radar size={19} />} /><Metric label="PORTS AVAILABLE" value="03" detail="Explicitly allowlisted lab ports" icon={<Layers3 size={19} />} /><Metric label="LAST OBSERVED OPEN" value={current ? String(openPorts).padStart(2, '0') : '—'} detail={current ? `Observed ${timestamp(current.finishedAt)} IST` : 'Run a check to collect evidence'} icon={<Globe size={19} />} /><Metric label="CHECKS RECORDED" value={String(scans.length).padStart(2, '0')} detail="Results retained in this workspace" icon={<History size={19} />} /></div>
    <div className="ops-recon-grid">
      <section className="panel ops-scan-config"><div className="panel-heading"><h2><Radar size={18} />Scan configuration</h2><span className="ops-mono-tag">TCP CONNECT</span></div>
        <form onSubmit={event => { event.preventDefault(); void runScan(); }}>
          <label className="field" htmlFor="recon-host">TARGET HOST<input className="input mono" id="recon-host" value="127.0.0.1" readOnly /><span className="ops-field-hint"><LockKeyhole size={12} />Fixed to the local lab. No external reconnaissance.</span></label>
          <fieldset className="ops-port-fieldset"><legend>PORT SELECTION</legend>{[9091, 9092, 9093].map(port => <label className="ops-port-option" key={port}><input type="checkbox" checked={ports.includes(port)} disabled={busy} onChange={event => setPorts(previous => event.target.checked ? [...previous, port].sort() : previous.filter(value => value !== port))} /><span className="mono">{port}</span><small>{port === 9091 ? 'HTTP training service' : 'Control port · expected closed'}</small></label>)}</fieldset>
          <button className="btn primary ops-full-button" type="submit" disabled={busy || !ports.length}>{busy ? <LoaderCircle size={16} className="ops-spin" /> : <Play size={16} />}{busy ? 'Checking local ports…' : 'Run local check'}<ArrowRight size={15} /></button>
          <InlineError message={error} />
        </form>
        <div className="ops-callout"><Terminal size={18} /><div><strong>Actual connections. Narrow scope.</strong><p>The backend attempts a TCP connection to each selected port. An open result confirms a listener at the time of the check; it does not identify vulnerabilities.</p></div></div>
      </section>
      <section className="panel ops-scan-output"><div className="panel-heading"><h2><Terminal size={18} />Connection results</h2>{busy ? <span className="ops-live-label"><span />CHECKING</span> : current ? <span className="badge info">LOCAL LAB</span> : <span className="ops-mono-tag">AWAITING CHECK</span>}</div>
        {current ? <><div className="ops-scan-run-meta"><span><span className="ops-muted-label">TARGET</span><strong className="mono">{current.host}</strong></span><span><span className="ops-muted-label">FINISHED</span><strong className="mono">{timestamp(current.finishedAt)} IST</strong></span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>PORT</th><th>STATE</th><th>SERVICE</th><th>LATENCY</th></tr></thead><tbody>{current.ports.map(port => <tr key={port.port}><td className="mono">{port.port}<span className="ops-subtle"> / TCP</span></td><td><span className={`ops-port-state ops-port-${port.state}`}><span />{port.state.toUpperCase()}</span></td><td>{port.service}</td><td className="mono">{port.latencyMs.toFixed(2)} <span className="ops-subtle">ms</span></td></tr>)}</tbody></table></div><div className="ops-terminal" aria-label="TCP connection check transcript"><div><span className="ops-terminal-prompt">&gt;</span> Local TCP connection check · {current.id}</div>{current.ports.map(port => <div key={port.port}><span className="ops-terminal-time">{timestamp(current.finishedAt).split(', ').pop()}</span><span className={port.state === 'open' ? 'ops-text-cyan' : 'ops-terminal-muted'}>{port.state.toUpperCase().padEnd(8, ' ')}</span><span>{current.host}:{port.port}</span><span className="ops-terminal-muted">{port.latencyMs.toFixed(2)}ms</span></div>)}<div className="ops-terminal-summary"><CheckCheck size={14} />{current.ports.length} ports checked · {openPorts} open · scope local-lab</div></div></> : <div className="ops-empty ops-recon-empty"><span className="ops-empty-icon"><Radar size={39} strokeWidth={1.2} /></span><h3>Your lab, in focus.</h3><p>Select the lab ports and run a local check.<br />Connection observations will appear here.</p><span className="ops-empty-meta mono">127.0.0.1 / TCP / 9091–9093</span></div>}
      </section>
    </div>
    <section className="panel ops-scan-history"><div className="panel-heading"><h2><History size={18} />Check history</h2><span className="ops-mono-tag">{scans.length} RECORDED</span></div>{scans.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>TIME · IST</th><th>TARGET</th><th>PORTS</th><th>OPEN</th><th>MODE</th><th><span className="ops-sr-only">Action</span></th></tr></thead><tbody>{scans.slice(0, 10).map(scan => <tr key={scan.id}><td className="mono">{timestamp(scan.startedAt)}</td><td className="mono">{scan.host}</td><td className="mono">{scan.ports.map(port => port.port).join(', ')}</td><td><span className="ops-text-cyan mono">{scan.ports.filter(port => port.state === 'open').length}</span></td><td><span className="ops-source">LOCAL LAB</span></td><td><button className="ops-text-button" onClick={() => setSelectedScanId(scan.id)} aria-label={`View check from ${timestamp(scan.startedAt)}`}>View results<ArrowRight size={14} /></button></td></tr>)}</tbody></table></div> : <p className="ops-inline-empty">No checks recorded yet. Your first connection check will establish a baseline.</p>}</section>
  </section>;
}

export function AttackLabPage({ state, refresh, notify, navigate }: PageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const nextIndex = state.lab.steps.findIndex(step => !step.completed);
  const completedCount = state.lab.steps.filter(step => step.completed).length;
  const selected = state.lab.steps.find(step => step.id === selectedId) ?? state.lab.steps[nextIndex < 0 ? state.lab.steps.length - 1 : nextIndex];
  const selectedIndex = state.lab.steps.findIndex(step => step.id === selected?.id);
  const canRun = selected && !selected.completed && selectedIndex === nextIndex;
  const percentage = state.lab.steps.length ? Math.round(completedCount / state.lab.steps.length * 100) : 0;

  async function runStep() {
    if (!selected || !canRun) return;
    setBusy(true); setError('');
    try {
      await api('/lab/step', { stepId: selected.id });
      await refresh();
      notify('Training step completed. Simulated evidence has been recorded.');
    } catch (cause) { const message = errorMessage(cause); setError(message); notify(message, 'error'); }
    finally { setBusy(false); }
  }

  async function resetLab() {
    setBusy(true); setError('');
    try {
      await api('/lab/reset', {});
      setSelectedId(null); setConfirmReset(false);
      await refresh(); notify('Training sequence reset.');
    } catch (cause) { const message = errorMessage(cause); setError(message); notify(message, 'error'); }
    finally { setBusy(false); }
  }

  return <section className="ops-page">
    <PageIntro label="02 / ADVERSARY EMULATION" title="Understand the attack. Practice the response." description="Follow a controlled attack storyline and see how each stage becomes defensive evidence."><span className="ops-simulation-badge"><Workflow size={14} />SIMULATION</span></PageIntro>
    <ScopeNote tone="amber">Training model only. Exploitation, privilege escalation, and command-and-control steps <strong>generate simulated records</strong>; they do not execute exploits or establish external sessions.</ScopeNote>
    <div className="panel ops-lab-progress"><div className="ops-lab-progress-icon"><ShieldAlert size={27} /></div><div><span className="ops-kicker">GUIDED ATTACK CHAIN</span><h2>{completedCount === state.lab.steps.length && completedCount ? 'Scenario complete. Keep the lessons.' : 'From first contact to incident report.'}</h2><p>Sequential steps mapped to MITRE ATT&amp;CK concepts.</p></div><div className="ops-lab-progress-count"><strong>{String(completedCount).padStart(2, '0')}<span> / {String(state.lab.steps.length).padStart(2, '0')}</span></strong><span>STEPS COMPLETED</span><div className="ops-progress-track"><span style={{ width: `${percentage}%` }} /></div></div><button className="btn secondary ops-reset-lab" onClick={() => setConfirmReset(true)} disabled={busy || !completedCount}><RotateCcw size={15} />Reset scenario</button></div>
    <div className="ops-lab-grid"><nav className="ops-lab-steps" aria-label="Training scenario steps">{state.lab.steps.map((step, index) => <button className={`ops-lab-step ${selected?.id === step.id ? 'ops-lab-step-selected' : ''} ${step.completed ? 'ops-lab-step-done' : ''}`} key={step.id} onClick={() => { setSelectedId(step.id); setError(''); }} disabled={busy}><span className="ops-step-number">{step.completed ? <Check size={18} /> : String(index + 1).padStart(2, '0')}</span><span className="ops-step-copy"><span className="ops-step-meta">{step.mitre}<span>{step.completed ? 'COMPLETE' : index === nextIndex ? 'READY' : 'UPCOMING'}</span></span><strong>{step.title}</strong></span>{selected?.id === step.id && <ChevronRight size={16} />}</button>)}</nav>
      <section className="panel ops-lab-detail">{selected ? <><div className="panel-heading"><h2><Terminal size={18} />Training console</h2><span className="ops-source">GENERATED TELEMETRY</span></div><div className="ops-lab-detail-body"><span className="ops-kicker">STEP {String(selectedIndex + 1).padStart(2, '0')} / {selected.mitre}</span><h2>{selected.title}</h2><p>{selected.description}</p><div className="ops-lab-stage-note"><Flag size={16} /><span>{selected.completed ? 'Completed step. Review the generated output below.' : canRun ? 'Previous steps complete. This training step is ready to run.' : 'Complete the preceding steps before running this stage.'}</span></div>
        <div className="ops-terminal ops-lab-terminal" aria-label="Training step output"><div className="ops-terminal-heading"><span className="ops-terminal-dots"><i /><i /><i /></span><span>AEGIS / TRAINING MODEL</span><span>SIMULATED</span></div>{selected.output?.length ? selected.output.map((line, index) => <div className="ops-lab-output-line" key={`${selected.id}-${index}`}><span className="ops-terminal-prompt">&gt;</span><span>{line}</span></div>) : <div className="ops-terminal-waiting"><Terminal size={24} /><p>{canRun ? 'Ready to generate this stage’s training evidence.' : 'No output generated for this step yet.'}</p><span>NO REAL EXPLOIT EXECUTION</span></div>}{selected.timestamp && <div className="ops-terminal-summary"><CircleCheck size={13} />Completed {timestamp(selected.timestamp)} IST</div>}</div>
        <InlineError message={error} /><div className="ops-lab-controls">{selected.completed ? <button className="btn secondary" onClick={() => nextIndex < 0 ? navigate('reports') : setSelectedId(state.lab.steps[nextIndex].id)}>{nextIndex < 0 ? <FileText size={16} /> : <ArrowRight size={16} />}{nextIndex < 0 ? 'Open incident report' : 'Continue to next step'}</button> : <button className="btn primary" disabled={busy || !canRun} onClick={() => void runStep()}>{busy ? <LoaderCircle size={16} className="ops-spin" /> : canRun ? <Play size={16} /> : <LockKeyhole size={16} />}{busy ? 'Running training step…' : canRun ? 'Run training step' : 'Complete preceding steps'}</button>}<button className="ops-text-button" onClick={() => navigate('logs')}>View event evidence<ArrowRight size={14} /></button></div>
      </div></> : <div className="ops-empty"><Workflow size={35} /><h3>No scenario loaded.</h3><p>Refresh the workspace to retrieve the training sequence.</p><button className="btn secondary" onClick={() => void refresh()}>Refresh scenario</button></div>}</section>
    </div>
    <div className="ops-lab-bottom-note"><InfoMark /><p><strong>The defender’s view.</strong> Each completed stage creates clearly labeled lab evidence. Inspect it in Event logs, investigate the corresponding alert, and connect the response to your NIST workflow.</p><button className="ops-text-button" onClick={() => navigate('nist')}>NIST workflow<ArrowRight size={14} /></button></div>
    {confirmReset && <Modal title="Reset the training scenario?" onClose={() => { if (!busy) setConfirmReset(false); }}><div className="ops-modal-body"><p>This returns the training sequence to its first step and removes its generated lab alerts and logs. Imported and sample evidence, operator actions, and scan results are retained.</p><p className="muted">Manual containment decisions are not reversed.</p><InlineError message={error} /><div className="ops-modal-actions"><button className="btn secondary" disabled={busy} onClick={() => setConfirmReset(false)}>Keep scenario</button><button className="btn danger" disabled={busy} onClick={() => void resetLab()}>{busy ? <LoaderCircle size={15} className="ops-spin" /> : <RotateCcw size={15} />}Reset training steps</button></div></div></Modal>}
  </section>;
}

function InfoMark() { return <span className="ops-info-mark">i</span>; }

type RuleDraft = { name: string; direction: 'inbound' | 'outbound'; action: 'allow' | 'deny'; source: string; destination: string; protocol: 'TCP' | 'UDP' | 'ANY'; port: string };
const defaultRule: RuleDraft = { name: '', direction: 'inbound', action: 'deny', source: 'any', destination: 'any', protocol: 'TCP', port: '' };

export function ResponsePage({ state, refresh, notify, openAsset }: PageProps) {
  const assets = state.assets.filter(asset => asset.kind === 'server' || asset.kind === 'workstation');
  const [assetId, setAssetId] = useState(assets[0]?.id ?? '');
  const [action, setAction] = useState<'isolate' | 'release' | 'investigate'>('isolate');
  const [reason, setReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(defaultRule);
  const [ruleBusy, setRuleBusy] = useState(false);
  const [ruleError, setRuleError] = useState('');
  const [deletingRule, setDeletingRule] = useState<FirewallRule | null>(null);
  const [toggleBusy, setToggleBusy] = useState('');
  const [policy, setPolicy] = useState({ direction: 'inbound' as 'inbound' | 'outbound', source: '10.24.8.40', destination: '10.24.1.10', protocol: 'TCP' as 'TCP' | 'UDP', port: '443' });
  const [evaluation, setEvaluation] = useState<FirewallEvaluation | null>(null);
  const [evaluationBusy, setEvaluationBusy] = useState(false);
  const [evaluationError, setEvaluationError] = useState('');
  const evaluationRequest = useRef(0);
  const selectedAsset = assets.find(asset => asset.id === assetId);
  const actions = [...state.actions].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const ruleSignature = JSON.stringify(state.rules);
  useEffect(() => { evaluationRequest.current += 1; setEvaluation(null); setEvaluationBusy(false); }, [ruleSignature]);

  async function applyAction() {
    if (!assetId || !reason.trim()) return;
    setActionBusy(true); setActionError('');
    try {
      await api(`/assets/${encodeURIComponent(assetId)}/action`, { action, reason: reason.trim() });
      await refresh(); setReason(''); notify(`Simulated ${action} action recorded for ${selectedAsset?.name ?? 'the asset'}.`);
    } catch (cause) { const message = errorMessage(cause); setActionError(message); notify(message, 'error'); }
    finally { setActionBusy(false); }
  }

  async function addRule() {
    setRuleBusy(true); setRuleError('');
    try {
      await api('/firewall/rules', { ...draft, name: draft.name.trim(), source: draft.source.trim(), destination: draft.destination.trim(), port: draft.port ? Number(draft.port) : null, enabled: true });
      await refresh(); setNewRuleOpen(false); setDraft(defaultRule); notify('Firewall simulation rule created.');
    } catch (cause) { const message = errorMessage(cause); setRuleError(message); notify(message, 'error'); }
    finally { setRuleBusy(false); }
  }

  async function toggleRule(rule: FirewallRule, enabled: boolean) {
    setToggleBusy(rule.id); setRuleError('');
    try {
      await api(`/firewall/rules/${encodeURIComponent(rule.id)}/toggle`, { enabled });
      await refresh(); notify(`Rule ${enabled ? 'enabled' : 'disabled'} in the simulator.`);
    } catch (cause) { const message = errorMessage(cause); setRuleError(message); notify(message, 'error'); }
    finally { setToggleBusy(''); }
  }

  async function deleteRule() {
    if (!deletingRule) return;
    setRuleBusy(true); setRuleError('');
    try {
      await api(`/firewall/rules/${encodeURIComponent(deletingRule.id)}`, undefined, 'DELETE');
      await refresh(); setDeletingRule(null); notify('Firewall simulation rule deleted.');
    } catch (cause) { const message = errorMessage(cause); setRuleError(message); notify(message, 'error'); }
    finally { setRuleBusy(false); }
  }

  async function evaluatePolicy() {
    const request = ++evaluationRequest.current;
    setEvaluationBusy(true); setEvaluationError(''); setEvaluation(null);
    try {
      const result = await api<FirewallEvaluation>('/firewall/evaluate', { ...policy, source: policy.source.trim(), destination: policy.destination.trim(), port: Number(policy.port) });
      if (request === evaluationRequest.current) setEvaluation(result);
    } catch (cause) {
      if (request !== evaluationRequest.current) return;
      const message = errorMessage(cause); setEvaluationError(message); notify(message, 'error');
    } finally { if (request === evaluationRequest.current) setEvaluationBusy(false); }
  }

  function updatePolicy(key: keyof typeof policy, value: string) {
    evaluationRequest.current += 1;
    setPolicy(previous => ({ ...previous, [key]: value })); setEvaluation(null); setEvaluationError(''); setEvaluationBusy(false);
  }

  return <section className="ops-page">
    <PageIntro label="03 / INCIDENT RESPONSE" title="Contain. Investigate. Recover." description="Practice deliberate containment decisions and test an ordered firewall policy."><span className="ops-simulation-badge"><Shield size={14} />SIMULATED CONTROLS</span></PageIntro>
    <ScopeNote tone="amber">Controls update <strong>this application’s simulation</strong>. They do not isolate actual devices, alter the host firewall, or block real network traffic.</ScopeNote>
    <div className="ops-response-grid"><section className="panel ops-containment-panel"><div className="panel-heading"><h2><ShieldAlert size={18} />Endpoint containment</h2><span className="ops-source">SIMULATION</span></div><form className="ops-panel-body" onSubmit={event => { event.preventDefault(); void applyAction(); }}>
      <label className="field" htmlFor="response-asset">TARGET ASSET<select id="response-asset" className="input" value={assetId} onChange={event => { setAssetId(event.target.value); setActionError(''); }} disabled={actionBusy || !assets.length}>{!assets.length && <option value="">No server or workstation assets</option>}{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.ip}</option>)}</select></label>
      {selectedAsset && <div className="ops-selected-asset"><span className="ops-asset-icon">{selectedAsset.kind === 'server' ? <Server size={21} /> : <Monitor size={21} />}</span><div><strong>{selectedAsset.name}</strong><span className="mono">{selectedAsset.ip} / {selectedAsset.zone}</span></div><button className="ops-asset-status-button" type="button" onClick={() => openAsset(selectedAsset)}><span className={`ops-asset-status ops-status-${selectedAsset.status}`}><span />{selectedAsset.status}</span><ChevronRight size={14} /></button></div>}
      <label className="field" htmlFor="response-action">RESPONSE ACTION<select id="response-action" className="input" value={action} disabled={actionBusy} onChange={event => setAction(event.target.value as typeof action)}><option value="isolate">Isolate endpoint</option><option value="investigate">Mark for investigation</option><option value="release">Release containment</option></select></label>
      <label className="field" htmlFor="response-reason">REASON FOR THIS ACTION<textarea id="response-reason" className="textarea" value={reason} onChange={event => setReason(event.target.value)} rows={3} minLength={5} maxLength={500} required placeholder="Document the evidence and reason for this decision…" disabled={actionBusy} /></label>
      <p className="ops-action-explainer">{action === 'isolate' ? 'Marks the selected endpoint isolated and records the reason in the audit trail.' : action === 'release' ? 'Returns the selected endpoint to online status in the simulator. Verify recovery before release.' : 'Marks the endpoint for investigation and records an operator action.'}</p>
      <button className={`btn ${action === 'isolate' ? 'danger' : 'primary'} ops-full-button`} type="submit" disabled={actionBusy || !assetId || reason.trim().length < 5}>{actionBusy ? <LoaderCircle size={16} className="ops-spin" /> : action === 'isolate' ? <ShieldOff size={16} /> : action === 'release' ? <ShieldCheck size={16} /> : <Search size={16} />}{actionBusy ? 'Recording action…' : action === 'isolate' ? 'Isolate in simulation' : action === 'release' ? 'Release containment' : 'Mark for investigation'}</button><InlineError message={actionError} />
    </form></section>
      <section className="panel ops-policy-test"><div className="panel-heading"><h2><Workflow size={18} />Policy evaluator</h2><span className="ops-mono-tag">FIRST MATCH / DEFAULT DENY</span></div><form className="ops-panel-body" onSubmit={event => { event.preventDefault(); void evaluatePolicy(); }}><p className="ops-section-description">Evaluate a hypothetical inbound or outbound flow against the ordered rules below. No packet is sent to the destination.</p><div className="ops-form-grid"><label className="field ops-policy-direction" htmlFor="policy-direction">FLOW DIRECTION<select id="policy-direction" className="input" value={policy.direction} onChange={event => updatePolicy('direction', event.target.value)}><option value="inbound">Inbound</option><option value="outbound">Outbound</option></select></label><label className="field" htmlFor="policy-source">SOURCE IPV4<input id="policy-source" className="input mono" value={policy.source} required onChange={event => updatePolicy('source', event.target.value)} placeholder="10.24.8.40" /></label><label className="field" htmlFor="policy-destination">DESTINATION IPV4<input id="policy-destination" className="input mono" value={policy.destination} required onChange={event => updatePolicy('destination', event.target.value)} placeholder="10.24.1.10" /></label><label className="field" htmlFor="policy-protocol">PROTOCOL<select id="policy-protocol" className="input" value={policy.protocol} onChange={event => updatePolicy('protocol', event.target.value)}><option>TCP</option><option>UDP</option></select></label><label className="field" htmlFor="policy-port">DESTINATION PORT<input id="policy-port" className="input mono" type="number" min="1" max="65535" required value={policy.port} onChange={event => updatePolicy('port', event.target.value)} /></label></div><button className="btn secondary" type="submit" disabled={evaluationBusy}>{evaluationBusy ? <LoaderCircle size={15} className="ops-spin" /> : <Play size={15} />}{evaluationBusy ? 'Evaluating…' : 'Evaluate flow'}</button><InlineError message={evaluationError} />{evaluation && <div className={`ops-evaluation-result ops-evaluation-${evaluation.action}`} role="status">{evaluation.action === 'allow' ? <ShieldCheck size={23} /> : <ShieldOff size={23} />}<div><strong>{evaluation.action.toUpperCase()}<span>{evaluation.matchedRule ? evaluation.matchedRule.name : 'Default policy'}</span></strong><p>{evaluation.explanation}</p><small className="mono">SIMULATION RESULT · NO TRAFFIC GENERATED</small></div></div>}</form></section>
    </div>
    <section className="panel ops-firewall-panel"><div className="panel-heading"><div><h2><Shield size={18} />Firewall policy</h2><p className="ops-heading-description">Ordered rules. First enabled match wins; unmatched flows are denied.</p></div><button className="btn primary" onClick={() => { setRuleError(''); setNewRuleOpen(true); }}><Plus size={16} />Add rule</button></div><InlineError message={!newRuleOpen && !deletingRule ? ruleError : ''} />{state.rules.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>ORDER</th><th>RULE / DIRECTION</th><th>ACTION</th><th>SOURCE</th><th>DESTINATION</th><th>PROTOCOL</th><th>PORT</th><th>ENABLED</th><th><span className="ops-sr-only">Actions</span></th></tr></thead><tbody>{state.rules.map((rule, index) => <tr key={rule.id} className={!rule.enabled ? 'ops-disabled-rule' : ''}><td className="mono ops-subtle">{String(index + 1).padStart(2, '0')}</td><td><strong>{rule.name}</strong><span className="ops-table-secondary">{rule.direction.toUpperCase()}</span></td><td><span className={`ops-rule-action ops-rule-${rule.action}`}>{rule.action.toUpperCase()}</span></td><td className="mono">{rule.source}</td><td className="mono">{rule.destination}</td><td className="mono">{rule.protocol}</td><td className="mono">{rule.port ?? 'ANY'}</td><td><label className="ops-toggle"><input type="checkbox" aria-label={`Enable rule ${rule.name}`} checked={rule.enabled} disabled={Boolean(toggleBusy) || ruleBusy} onChange={event => void toggleRule(rule, event.target.checked)} /><span /></label></td><td><button className="ops-icon-button ops-delete-button" aria-label={`Delete rule ${rule.name}`} disabled={Boolean(toggleBusy) || ruleBusy} onClick={() => { setRuleError(''); setDeletingRule(rule); }}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div> : <div className="ops-empty ops-compact-empty"><Shield size={29} /><h3>No explicit rules.</h3><p>The simulated default policy denies every unmatched flow. Add a rule to practice matching.</p></div>}<div className="ops-table-footnote"><LockKeyhole size={13} /><span>Default: DENY · IPv4/CIDR or “any” · A blank rule port matches every port.</span></div></section>
    <section className="panel ops-audit-panel"><div className="panel-heading"><h2><History size={18} />Operator audit trail</h2><span className="ops-mono-tag">{actions.length} ACTIONS</span></div>{actions.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>TIME · IST</th><th>ACTOR / MODE</th><th>ACTION</th><th>TARGET</th><th>REASON / RESULT</th></tr></thead><tbody>{actions.slice(0, 12).map(entry => <tr key={entry.id}><td className="mono ops-audit-time">{timestamp(entry.timestamp)}</td><td><strong>{entry.actor}</strong><span className="ops-table-secondary">{entry.mode}</span></td><td>{entry.action}</td><td className="mono">{entry.target}</td><td className="ops-audit-reason"><span>{entry.reason}</span><span className="ops-table-secondary">{entry.result}</span></td></tr>)}</tbody></table></div> : <p className="ops-inline-empty">No operator actions yet. Containment and policy changes will appear here with their reasons.</p>}</section>
    {newRuleOpen && <Modal title="Create a simulation rule" wide onClose={() => { if (!ruleBusy) setNewRuleOpen(false); }}><form className="ops-modal-body" onSubmit={event => { event.preventDefault(); void addRule(); }}><ScopeNote>Rules apply only to AEGIS’s policy evaluator. New rules are appended after the existing policy.</ScopeNote><label className="field" htmlFor="rule-name">RULE NAME<input id="rule-name" className="input" required minLength={3} maxLength={80} value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} placeholder="e.g. Deny suspicious source" /></label><div className="ops-form-grid"><label className="field" htmlFor="rule-direction">DIRECTION<select id="rule-direction" className="input" value={draft.direction} onChange={event => setDraft(previous => ({ ...previous, direction: event.target.value as RuleDraft['direction'] }))}><option value="inbound">Inbound</option><option value="outbound">Outbound</option></select></label><label className="field" htmlFor="rule-action">ACTION<select id="rule-action" className="input" value={draft.action} onChange={event => setDraft(previous => ({ ...previous, action: event.target.value as RuleDraft['action'] }))}><option value="deny">Deny</option><option value="allow">Allow</option></select></label><label className="field" htmlFor="rule-source">SOURCE · IPV4 / CIDR / ANY<input id="rule-source" className="input mono" value={draft.source} required onChange={event => setDraft(previous => ({ ...previous, source: event.target.value }))} placeholder="any or 10.0.0.0/24" /></label><label className="field" htmlFor="rule-destination">DESTINATION · IPV4 / CIDR / ANY<input id="rule-destination" className="input mono" value={draft.destination} required onChange={event => setDraft(previous => ({ ...previous, destination: event.target.value }))} placeholder="any or 10.0.0.10" /></label><label className="field" htmlFor="rule-protocol">PROTOCOL<select id="rule-protocol" className="input" value={draft.protocol} onChange={event => setDraft(previous => ({ ...previous, protocol: event.target.value as RuleDraft['protocol'] }))}><option>TCP</option><option>UDP</option><option>ANY</option></select></label><label className="field" htmlFor="rule-port">DESTINATION PORT · OPTIONAL<input id="rule-port" className="input mono" type="number" min="1" max="65535" value={draft.port} onChange={event => setDraft(previous => ({ ...previous, port: event.target.value }))} placeholder="Blank for any port" /></label></div><InlineError message={ruleError} /><div className="ops-modal-actions"><button className="btn secondary" type="button" disabled={ruleBusy} onClick={() => setNewRuleOpen(false)}>Cancel</button><button className="btn primary" type="submit" disabled={ruleBusy || draft.name.trim().length < 3}>{ruleBusy ? <LoaderCircle size={15} className="ops-spin" /> : <Plus size={15} />}{ruleBusy ? 'Saving rule…' : 'Create rule'}</button></div></form></Modal>}
    {deletingRule && <Modal title="Delete simulation rule?" onClose={() => { if (!ruleBusy) setDeletingRule(null); }}><div className="ops-modal-body"><p>Remove <strong>{deletingRule.name}</strong> from the ordered simulation policy? Flow evaluations will use the remaining enabled rules.</p><InlineError message={ruleError} /><div className="ops-modal-actions"><button className="btn secondary" disabled={ruleBusy} onClick={() => setDeletingRule(null)}>Keep rule</button><button className="btn danger" disabled={ruleBusy} onClick={() => void deleteRule()}>{ruleBusy ? <LoaderCircle size={15} className="ops-spin" /> : <Trash2 size={15} />}Delete rule</button></div></div></Modal>}
  </section>;
}

const nistFunctions = [
  { id: 'Govern', code: 'GV', description: 'Clarify ownership, policy, and decision records.' },
  { id: 'Identify', code: 'ID', description: 'Establish affected assets and incident scope.' },
  { id: 'Protect', code: 'PR', description: 'Review preventive controls and access.' },
  { id: 'Detect', code: 'DE', description: 'Validate observations and preserve evidence.' },
  { id: 'Respond', code: 'RS', description: 'Document analysis and containment actions.' },
  { id: 'Recover', code: 'RC', description: 'Verify restoration and capture improvements.' },
] as const;

export function ReportsPage({ state, notify, navigate, openAlert }: PageProps) {
  const [busyFormat, setBusyFormat] = useState('');
  const [error, setError] = useState('');
  const activeAlerts = state.alerts.filter(alert => alert.status === 'open' || alert.status === 'investigating');
  const urgentAlerts = activeAlerts.filter(alert => alert.severity === 'critical' || alert.severity === 'high');
  const isolated = state.assets.filter(asset => asset.status === 'isolated');
  const affectedAssets = new Set(activeAlerts.map(alert => alert.targetId).filter(Boolean));
  const actions = [...state.actions].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const reportAlerts = [...activeAlerts].sort((a, b) => {
    const weights = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return weights[b.severity] - weights[a.severity] || Date.parse(b.timestamp) - Date.parse(a.timestamp);
  });

  async function exportReport(format: 'json' | 'md' | 'csv') {
    setBusyFormat(format); setError('');
    try {
      const response = await fetch(`/api/report?format=${format}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `Report export failed (${response.status}).`);
      }
      const content = await response.text();
      if (!content.trim()) throw new Error('The server returned an empty report.');
      const types = { json: 'application/json', md: 'text/markdown', csv: 'text/csv' };
      downloadText(content, `aegis-incident-report.${format}`, types[format]);
      notify(`Report exported as ${format === 'md' ? 'Markdown' : format.toUpperCase()}.`);
    } catch (cause) { const message = errorMessage(cause); setError(message); notify(message, 'error'); }
    finally { setBusyFormat(''); }
  }

  return <section className="ops-page">
    <PageIntro label="04 / REPORTING & ASSURANCE" title="Turn evidence into a clear response." description="An incident brief built from your current workspace, with a NIST CSF 2.0 lens."><button className="btn secondary" onClick={() => navigate('nist')}><ListChecks size={16} />Open NIST workflow<ArrowRight size={14} /></button></PageIntro>
    <div className="ops-report-toolbar panel"><div><span className="ops-kicker">EXPORT CURRENT WORKSPACE</span><p>Include recorded alerts, event evidence, policy, and operator actions.</p></div><div className="ops-export-buttons">{([{ format: 'md', label: 'Markdown', icon: FileText }, { format: 'json', label: 'JSON', icon: FileJson }, { format: 'csv', label: 'CSV', icon: ArrowDownToLine }] as const).map(({ format, label, icon: Icon }) => <button key={format} className={`btn ${format === 'md' ? 'primary' : 'secondary'}`} disabled={Boolean(busyFormat)} onClick={() => void exportReport(format)}>{busyFormat === format ? <LoaderCircle className="ops-spin" size={15} /> : <Icon size={15} />}{busyFormat === format ? 'Exporting…' : `Export ${label}`}</button>)}</div></div><InlineError message={error} />
    <div className="ops-report-grid"><article className="panel ops-report-document"><header className="ops-report-document-header"><div className="ops-report-brand"><span><Shield size={22} /></span><strong>AEGIS<span>INCIDENT BRIEF</span></strong></div><span className="ops-simulation-badge">SIMULATION WORKSPACE</span></header><div className="ops-report-title"><span className="ops-kicker">CURRENT STATE / ANALYST REVIEW</span><h2>Security operations<br />incident report.</h2><div className="ops-report-metadata"><span><span className="ops-muted-label">SNAPSHOT UPDATED</span><strong className="mono">{timestamp(state.updatedAt)} IST</strong></span><span><span className="ops-muted-label">FRAMEWORK</span><strong>NIST CSF 2.0</strong></span><span><span className="ops-muted-label">SCOPE</span><strong>Local application workspace</strong></span></div></div>
      <section className="ops-report-section"><div className="ops-report-section-title"><span>01</span><h3>Executive summary</h3><span className="ops-source">IDENTIFY / DETECT</span></div><p>The workspace currently holds <strong>{activeAlerts.length} active alerts</strong> across <strong>{affectedAssets.size} referenced assets</strong>. Of these, <strong>{urgentAlerts.length} are high or critical severity</strong>. <strong>{isolated.length} {isolated.length === 1 ? 'asset is' : 'assets are'} marked isolated</strong> in the containment simulator.</p><div className="ops-report-counters"><div><strong>{state.logs.length}</strong><span>EVENT RECORDS</span></div><div><strong>{state.actions.length}</strong><span>OPERATOR ACTIONS</span></div><div><strong>{state.scans.length}</strong><span>LOCAL TCP CHECKS</span></div></div><div className="ops-report-provenance"><CircleAlert size={15} /><p>Records may be sample, user-imported, or lab-generated. Containment and policy actions are simulated. This report describes workspace evidence; it does not establish that a real incident occurred.</p></div></section>
      <section className="ops-report-section"><div className="ops-report-section-title"><span>02</span><h3>Priority observations</h3><span className="ops-source">DETECT / RESPOND</span></div>{reportAlerts.length ? <div className="ops-report-alerts">{reportAlerts.slice(0, 5).map(alert => <button className="ops-report-alert" key={alert.id} onClick={() => openAlert(alert)}><span className={`badge ${alert.severity}`}>{alert.severity}</span><div><strong>{alert.title}</strong><span>{alert.category}<span>·</span>{state.assets.find(asset => asset.id === alert.targetId)?.name ?? alert.targetId}<span>·</span>{alert.origin}</span></div><ChevronRight size={15} /></button>)}</div> : <p className="ops-report-empty">No active alerts are currently recorded. Continue reviewing evidence and validating your controls.</p>}</section>
      <section className="ops-report-section"><div className="ops-report-section-title"><span>03</span><h3>Response activity</h3><span className="ops-source">RESPOND</span></div>{actions.length ? <ol className="ops-report-timeline">{actions.slice(0, 6).map(action => <li key={action.id}><span className="ops-report-timeline-marker" /><div><div><strong>{action.action}</strong><time className="mono" dateTime={action.timestamp}>{timestamp(action.timestamp)} IST</time></div><p><span className="mono">{action.target}</span> · {action.reason}</p><span className="ops-report-action-result">{action.result} · {action.mode}</span></div></li>)}</ol> : <p className="ops-report-empty">No operator response actions recorded yet. Each containment or policy decision will create an audit entry.</p>}</section>
      <section className="ops-report-section"><div className="ops-report-section-title"><span>04</span><h3>Recovery & next steps</h3><span className="ops-source">RECOVER / GOVERN</span></div><ul className="ops-report-next-steps"><li><Check size={15} /><span>Validate the origin, timestamps, and scope of imported evidence before drawing conclusions.</span></li><li><Check size={15} /><span>{isolated.length ? `Review the ${isolated.length} isolated ${isolated.length === 1 ? 'asset' : 'assets'}, document remediation, and verify recovery before release.` : 'Define recovery criteria and validate service health before closing an investigation.'}</span></li><li><Check size={15} /><span>{urgentAlerts.length ? `Prioritize the ${urgentAlerts.length} high or critical active ${urgentAlerts.length === 1 ? 'alert' : 'alerts'} and assign a documented response decision.` : 'Review lower-priority observations and capture lessons learned from the training workflow.'}</span></li><li><Check size={15} /><span>Record accountable owners and improvements in the NIST workflow; self-reported controls are not a compliance assessment.</span></li></ul></section><footer className="ops-report-document-footer"><Shield size={13} /><span>AEGIS OPERATIONS / LOCAL WORKSPACE EVIDENCE</span><span>NIST CSF 2.0 ALIGNED STRUCTURE</span></footer></article>
      <aside className="ops-report-sidebar"><section className="panel ops-report-readiness"><div className="panel-heading"><h2><ListChecks size={18} />Framework coverage</h2></div><p>NIST Cybersecurity Framework 2.0 functions. Checklist progress is self-reported.</p><div className="ops-nist-function-list">{nistFunctions.map(item => { const controls = state.nistControls.filter(control => control.function === item.id); const done = controls.filter(control => control.done).length; return <button key={item.id} onClick={() => navigate('nist')}><span className="ops-function-code mono">{item.code}</span><span><strong>{item.id}</strong><small>{item.description}</small><span className="ops-function-track"><span style={{ width: `${controls.length ? done / controls.length * 100 : 0}%` }} /></span></span><span className="ops-function-count mono">{done}/{controls.length}</span></button>; })}</div></section><section className="panel ops-report-sources"><div className="panel-heading"><h2><Layers3 size={17} />Evidence provenance</h2></div>{(['sample', 'imported', 'lab'] as const).map(origin => <div key={origin}><span><i className={`ops-origin-dot ops-origin-${origin}`} />{origin === 'sample' ? 'Sample telemetry' : origin === 'imported' ? 'Imported records' : 'Training lab'}</span><strong className="mono">{state.logs.filter(log => log.origin === origin).length}</strong></div>)}<p>Counts reflect event records. Exported reports use the backend’s current workspace state.</p></section></aside>
    </div>
  </section>;
}
