import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, ArrowRight, Check, ChevronRight, FileUp, Fingerprint, Globe2, HardDrive, LockKeyhole, Mail, Network, Pause, Play, Plus, Radar, Search, Server, ShieldCheck, ShieldEllipsis, Terminal, Trash2, Upload, Wifi } from 'lucide-react';
import type { Asset, LogEvent, PageProps, Severity } from '../types';
import { analyzePhishing, classifyIp, csvCell, sameIp } from '../../shared/analysis';
import type { PhishingAnalysis } from '../../shared/analysis';
import { api, downloadText, errorMessage } from '../lib/api';
import Modal from './Modal';
import './Monitoring.css';

const severities: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const dateTime = (timestamp: string) => new Date(timestamp).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const timeOnly = (timestamp: string) => new Date(timestamp).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
const sourceTone = (score: number) => score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
const OriginBadge = ({ origin }: { origin: string }) => <span className={`mon-origin mon-origin-${origin}`}>{origin}</span>;
const Empty = ({ title, detail }: { title: string; detail: string }) => <div className="mon-empty"><Search size={25} /><strong>{title}</strong><p>{detail}</p></div>;
const ErrorNote = ({ message }: { message: string }) => message ? <div role="alert" className="mon-error"><AlertTriangle size={16} />{message}</div> : null;

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mon-page-heading"><div><div className="mon-eyebrow">{eyebrow}</div><h1 className="page-title">{title}<span className="mon-heading-dot">.</span></h1><p>{description}</p></div>{action}</div>;
}

export function IntelligencePage({ state, refresh, notify, openAlert }: PageProps) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [busyIp, setBusyIp] = useState('');
  const [phishingInput, setPhishingInput] = useState('');
  const [analysis, setAnalysis] = useState<PhishingAnalysis | null>(null);
  const [showVpn, setShowVpn] = useState(false);
  const sources = useMemo(() => {
    const counts = new Map<string, { ip: string; events: number; alerts: number; latest: string; vpn: boolean; origins: string[] }>();
    for (const log of state.logs) {
      const previous = counts.get(log.sourceIp) ?? { ip: log.sourceIp, events: 0, alerts: 0, latest: log.timestamp, vpn: false, origins: [] };
      previous.events++; previous.vpn ||= Boolean(log.vpn);
      if (!previous.origins.includes(log.origin)) previous.origins.push(log.origin);
      if (log.timestamp > previous.latest) previous.latest = log.timestamp;
      counts.set(log.sourceIp, previous);
    }
    for (const alert of state.alerts) {
      const previous = counts.get(alert.sourceIp) ?? { ip: alert.sourceIp, events: 0, alerts: 0, latest: alert.timestamp, vpn: false, origins: [] };
      previous.alerts++; if (!previous.origins.includes(alert.origin)) previous.origins.push(alert.origin); counts.set(alert.sourceIp, previous);
    }
    return [...counts.values()].sort((a, b) => b.alerts - a.alerts || b.events - a.events);
  }, [state.logs, state.alerts]);
  const classification = searched ? classifyIp(searched) : null;
  const correlatedLogs = searched ? state.logs.filter(log => sameIp(log.sourceIp, searched) || sameIp(log.destinationIp, searched)).sort((a, b) => b.timestamp.localeCompare(a.timestamp)) : [];
  const correlatedAlerts = searched ? state.alerts.filter(alert => sameIp(alert.sourceIp, searched)) : [];
  const watched = searched ? state.watchlist.some(ip => sameIp(ip, searched)) : false;
  const vpnEvents = state.logs.filter(log => log.vpn).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  function lookup(value = query) {
    if (!classifyIp(value).valid) { setLookupError(classifyIp(value).explanation); return; }
    setQuery(value.trim()); setSearched(value.trim()); setLookupError('');
  }
  async function toggleWatch(ip: string) {
    setBusyIp(ip);
    try {
      const existing = state.watchlist.find(item => sameIp(item, ip));
      if (existing) await api(`/watchlist/${encodeURIComponent(existing)}`, undefined, 'DELETE');
      else await api('/watchlist', { ip });
      await refresh(); notify(existing ? 'Address removed from watchlist.' : 'Address added to watchlist.');
    } catch (error) { notify(errorMessage(error), 'error'); }
    finally { setBusyIp(''); }
  }

  return <div className="mon-page">
    <PageHeading eyebrow="DETECTION / INTELLIGENCE" title="Threat intelligence" description="Connect the signals. Understand the source." action={<span className="mon-context-tag"><Radar size={14} /> LOCAL ANALYSIS</span>} />
    <div className="mon-metrics">
      <div className="mon-metric"><span className="mon-metric-icon"><Globe2 size={19} /></span><div><span>Observed source addresses</span><strong>{sources.length.toString().padStart(2, '0')}</strong></div><span className="mon-metric-tail">From event data</span></div>
      <div className="mon-metric"><span className="mon-metric-icon mon-icon-blue"><Wifi size={19} /></span><div><span>VPN-tagged events</span><strong>{vpnEvents.length.toString().padStart(2, '0')}</strong></div><button className="mon-text-button" onClick={() => setShowVpn(!showVpn)}>{showVpn ? 'Hide events' : 'Inspect events'} <ArrowRight size={13} /></button></div>
      <div className="mon-metric"><span className="mon-metric-icon mon-icon-amber"><Fingerprint size={19} /></span><div><span>Watchlist addresses</span><strong>{state.watchlist.length.toString().padStart(2, '0')}</strong></div><span className="mon-metric-tail">Analyst maintained</span></div>
    </div>
    <div className="mon-intel-grid">
      <section className="panel mon-panel mon-ip-panel">
        <div className="mon-panel-heading"><div className="mon-panel-icon"><Search size={18} /></div><div><h2>Investigate an address</h2><p>Correlate an IPv4 or IPv6 address with your telemetry</p></div><span className="mon-step">01</span></div>
        <form className="mon-lookup-form" onSubmit={event => { event.preventDefault(); lookup(); }}><div className="mon-search-input"><Globe2 size={16} /><input aria-label="IP address to investigate" placeholder="Enter an IPv4 or IPv6 address" value={query} onChange={event => setQuery(event.target.value)} spellCheck={false} autoComplete="off" /></div><button className="btn primary" type="submit">Investigate <ArrowRight size={15} /></button></form>
        <ErrorNote message={lookupError} />
        {classification?.valid ? <div className="mon-ip-result">
          <div className="mon-result-header"><div><span className="mon-label">ADDRESS PROFILE</span><h3 className="mono">{searched}</h3></div><span className={`mon-scope mon-scope-${classification.scope}`}>{classification.scope} IPv{classification.version}</span></div>
          <p className="mon-honesty">{classification.explanation}</p>
          <div className="mon-result-stats"><div><strong>{correlatedLogs.length}</strong><span>correlated events</span></div><div><strong>{correlatedAlerts.length}</strong><span>associated alerts</span></div><button className={`btn ${watched ? 'secondary' : 'primary'}`} disabled={Boolean(busyIp)} onClick={() => void toggleWatch(searched)}>{watched ? <Check size={14} /> : <Plus size={14} />}{busyIp ? 'Updating…' : watched ? 'Watching' : 'Add to watchlist'}</button></div>
          {correlatedAlerts.length > 0 && <div className="mon-correlated">{correlatedAlerts.slice(0, 3).map(alert => <button key={alert.id} onClick={() => openAlert(alert)}><span className={`mon-severity-dot mon-dot-${alert.severity}`} /><span>{alert.title}</span><OriginBadge origin={alert.origin} /><ChevronRight size={15} /></button>)}</div>}
          {correlatedLogs.length > 0 ? <div className="mon-related-events">{correlatedLogs.slice(0, 3).map(log => <div key={log.id}><span className="mono muted">{timeOnly(log.timestamp)}</span><span>{log.event.replaceAll('_', ' ')}</span><OriginBadge origin={log.origin} /></div>)}</div> : <p className="mon-honesty">No matching events in the current dataset. Absence of a match does not establish safety.</p>}
        </div> : <div className="mon-investigate-idle"><div className="mon-radar-orbit"><Radar size={34} /><i /><b /></div><strong>Every connection has a story.</strong><p>Select an observed address below or enter one to trace its activity.</p><span><LockKeyhole size={12} /> Runs locally · no external lookup</span></div>}
      </section>
      <section className="panel mon-panel mon-phishing-panel">
        <div className="mon-panel-heading"><div className="mon-panel-icon mon-icon-blue"><Mail size={18} /></div><div><h2>Phishing analyzer</h2><p>Examine a message or link before you trust it</p></div><span className="mon-step">02</span></div>
        <label className="mon-label" htmlFor="phishing-input">EMAIL CONTENT OR URL</label>
        <textarea id="phishing-input" className="textarea mon-phishing-input" rows={5} maxLength={30000} placeholder={'Paste a suspicious email, HTML link, or URL here…\n\nWe look for deceptive destinations, urgency and credential requests.'} value={phishingInput} onChange={event => { setPhishingInput(event.target.value); setAnalysis(null); }} />
        <div className="mon-analyze-actions"><span><LockKeyhole size={12} /> Local heuristics. Input is not stored.</span><button className="btn secondary" disabled={!phishingInput.trim()} onClick={() => setAnalysis(analyzePhishing(phishingInput))}><ShieldCheck size={15} /> Analyze content</button></div>
        {analysis && <div className={`mon-analysis mon-analysis-${analysis.risk}`} aria-live="polite"><div className="mon-analysis-heading"><span className="mon-analysis-symbol"><ShieldEllipsis size={22} /></span><div><strong>{analysis.risk === 'low' ? 'Few known indicators' : `${analysis.risk === 'high' ? 'High' : 'Elevated'} suspicion`}</strong><p>Heuristic score · not a reputation verdict</p></div><span className="mon-score">{analysis.score}<small>/100</small></span></div><div className="mon-score-track"><span style={{ width: `${analysis.score}%` }} /></div><p className="mon-honesty">{analysis.summary}</p>{analysis.signals.map(signal => <div className="mon-signal" key={signal.id}><AlertTriangle size={14} /><div><strong>{signal.title}</strong><p>{signal.detail}</p></div></div>)}{analysis.urls.length > 0 && <details className="mon-url-details"><summary>{analysis.urls.length} extracted destination{analysis.urls.length === 1 ? '' : 's'} <span>not opened</span></summary>{analysis.urls.map(url => <code key={url}>{url}</code>)}</details>}</div>}
        {!analysis && <div className="mon-analysis-features"><span><Check size={12} /> Hostname deception</span><span><Check size={12} /> Urgency signals</span><span><Check size={12} /> Link mismatch</span></div>}
      </section>
    </div>
    {showVpn && <section className="panel mon-panel"><div className="mon-section-heading"><div><h2><Wifi size={17} /> VPN event visibility</h2><p>Events explicitly marked as VPN traffic. These records cannot reveal a user's underlying address.</p></div><span className="mon-counter">{vpnEvents.length} EVENTS</span></div>{vpnEvents.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Timestamp · IST</th><th>Source address</th><th>Event</th><th>Severity</th><th>Origin</th></tr></thead><tbody>{vpnEvents.slice(0, 20).map(log => <tr key={log.id}><td className="mono muted">{dateTime(log.timestamp)}</td><td><button className="mon-ip-link mono" onClick={() => lookup(log.sourceIp)}>{log.sourceIp}</button></td><td>{log.event.replaceAll('_', ' ')}</td><td><span className={`badge ${log.severity}`}>{log.severity}</span></td><td><OriginBadge origin={log.origin} /></td></tr>)}</tbody></table></div> : <Empty title="No VPN-tagged events" detail="Only events explicitly marked vpn: true appear here." />}</section>}
    <section className="panel mon-panel"><div className="mon-section-heading"><div><h2><Network size={17} /> Observed sources</h2><p>Source addresses ranked by associated alerts, then event volume</p></div><span className="mon-counter">{sources.length} ADDRESSES</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Source address</th><th>Classification</th><th>Events</th><th>Alerts</th><th>Last observed · IST</th><th>Origin</th><th>Watchlist</th><th aria-label="Actions" /></tr></thead><tbody>{sources.slice(0, 16).map(source => <tr key={source.ip}><td><button className="mon-ip-link mono" onClick={() => lookup(source.ip)}>{source.ip}</button>{source.vpn && <span className="mon-vpn-tag">VPN</span>}</td><td><span className="mon-subtle-chip">{classifyIp(source.ip).scope ?? 'unknown'}</span></td><td className="mono">{source.events}</td><td><span className={source.alerts ? 'mon-alert-count' : 'muted'}>{source.alerts.toString().padStart(2, '0')}</span></td><td className="mono muted">{dateTime(source.latest)}</td><td><span className="mon-source-origins">{source.origins.map(origin => <OriginBadge key={origin} origin={origin} />)}</span></td><td>{state.watchlist.some(ip => sameIp(ip, source.ip)) ? <span className="mon-watching"><span /> Watching</span> : <span className="muted">—</span>}</td><td><button className="mon-row-button" aria-label={`Investigate ${source.ip}`} onClick={() => lookup(source.ip)}><ArrowRight size={16} /></button></td></tr>)}</tbody></table></div>{!sources.length && <Empty title="No sources observed yet" detail="Import event logs to start correlating source activity." />}</section>
    <section className="mon-watchlist-strip"><div><Fingerprint size={17} /><strong>Your watchlist</strong><span className="muted">{state.watchlist.length ? 'Click an address to investigate' : 'Investigate an address and add it to track it here'}</span></div><div className="mon-watchlist-items">{state.watchlist.map(ip => <span key={ip}><button className="mono" onClick={() => lookup(ip)}>{ip}</button><button title={`Remove ${ip}`} aria-label={`Remove ${ip} from watchlist`} disabled={Boolean(busyIp)} onClick={() => void toggleWatch(ip)}><Trash2 size={12} /></button></span>)}</div></section>
  </div>;
}

export function AssetsPage({ state, openAsset, navigate }: PageProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('risk');
  const assets = useMemo(() => state.assets.filter(asset => (kind === 'all' || asset.kind === kind) && (status === 'all' || asset.status === status) && `${asset.name} ${asset.ip} ${asset.os} ${asset.owner} ${asset.zone} ${asset.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'risk' ? b.risk - a.risk : a.name.localeCompare(b.name)), [state.assets, query, kind, status, sort]);
  const riskAverage = state.assets.length ? Math.round(state.assets.reduce((sum, asset) => sum + asset.risk, 0) / state.assets.length) : 0;
  const iconFor = (asset: Asset) => asset.kind === 'server' ? <Server size={18} /> : asset.kind === 'gateway' ? <Network size={18} /> : <HardDrive size={18} />;
  return <div className="mon-page">
    <PageHeading eyebrow="VISIBILITY / INVENTORY" title="Asset inventory" description="Know your environment. Protect what matters." action={<button className="btn secondary" onClick={() => navigate('response')}><ShieldCheck size={16} /> Response center <ArrowRight size={14} /></button>} />
    <div className="mon-metrics mon-assets-metrics"><div className="mon-metric"><span className="mon-metric-icon"><Server size={20} /></span><div><span>Total managed assets</span><strong>{state.assets.length.toString().padStart(2, '0')}</strong></div><span className="mon-metric-tail">Across {new Set(state.assets.map(asset => asset.zone)).size} zones</span></div><div className="mon-metric"><span className="mon-metric-icon mon-icon-amber"><Activity size={20} /></span><div><span>Average risk score</span><strong>{riskAverage}<small>/100</small></strong></div><span className="mon-metric-tail">Model-based assessment</span></div><div className="mon-metric"><span className="mon-metric-icon mon-icon-red"><LockKeyhole size={19} /></span><div><span>Isolated assets</span><strong>{state.assets.filter(asset => asset.status === 'isolated').length.toString().padStart(2, '0')}</strong></div><span className="mon-metric-tail">Simulated containment</span></div></div>
    <section className="panel mon-panel mon-inventory-panel"><div className="mon-inventory-heading"><div><h2><Server size={17} /> Your environment</h2><p>A unified view of endpoints, infrastructure and gateways.</p></div><span className="mon-counter">{assets.length} / {state.assets.length} ASSETS</span></div><div className="mon-toolbar"><div className="mon-search-input"><Search size={16} /><input aria-label="Search assets" placeholder="Search name, IP, OS or tag…" value={query} onChange={event => setQuery(event.target.value)} /></div><label className="mon-filter"><span>Type</span><select aria-label="Filter asset type" value={kind} onChange={event => setKind(event.target.value)}><option value="all">All types</option><option value="server">Servers</option><option value="workstation">Workstations</option><option value="gateway">Gateways</option></select></label><label className="mon-filter"><span>Status</span><select aria-label="Filter asset status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="online">Online</option><option value="investigating">Investigating</option><option value="isolated">Isolated</option></select></label><label className="mon-filter mon-sort"><span>Sort</span><select aria-label="Sort assets" value={sort} onChange={event => setSort(event.target.value)}><option value="risk">Highest risk</option><option value="name">Name A–Z</option></select></label></div>
      <div className="table-wrap"><table className="data-table mon-assets-table"><thead><tr><th>Asset / address</th><th>Type / operating system</th><th>Zone</th><th>Risk score</th><th>Status</th><th>Origin</th><th aria-label="Actions" /></tr></thead><tbody>{assets.map(asset => <tr key={asset.id}><td><div className="mon-asset-name"><span className={`mon-asset-icon mon-kind-${asset.kind}`}>{iconFor(asset)}</span><div><button onClick={() => openAsset(asset)}>{asset.name}</button><span className="mono">{asset.ip}</span></div></div></td><td><div className="mon-table-stack"><strong className="mon-capitalize">{asset.kind}</strong><span>{asset.os}</span></div></td><td><div className="mon-table-stack"><strong>{asset.zone}</strong><span>{asset.tags.slice(0, 2).join(' · ')}</span></div></td><td><div className={`mon-risk mon-risk-${sourceTone(asset.risk)}`}><strong>{asset.risk}<span>/100</span></strong><div><i style={{ width: `${Math.max(0, Math.min(100, asset.risk))}%` }} /></div></div></td><td><span className={`mon-status mon-status-${asset.status}`}><i />{asset.status}</span></td><td><OriginBadge origin={asset.origin} /></td><td><button className="mon-row-button" aria-label={`View details for ${asset.name}`} onClick={() => openAsset(asset)}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div>{!assets.length && <Empty title="No matching assets" detail="Try another search or clear the type and status filters." />}<div className="mon-table-footer"><span><span className="mon-live-dot" /> Inventory reflects current server state</span><span>Containment actions are available in asset details</span></div>
    </section>
    <div className="mon-inventory-note"><ShieldCheck size={18} /><div><strong>Context before containment.</strong><p>Open an asset to review its services, associated alerts and response history before taking action.</p></div><button className="mon-text-button" onClick={() => navigate('response')}>Explore response <ArrowRight size={14} /></button></div>
  </div>;
}

export function LogsPage({ state, refresh, notify }: PageProps) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const [source, setSource] = useState('');
  const [eventType, setEventType] = useState('all');
  const [snapshot, setSnapshot] = useState<LogEvent[] | null>(null);
  const [selected, setSelected] = useState<LogEvent | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const logs = snapshot ?? state.logs;
  const eventTypes = useMemo(() => [...new Set(logs.map(log => log.event))].sort(), [logs]);
  const filtered = useMemo(() => logs.filter(log => (severity === 'all' || log.severity === severity) && (!source || log.sourceIp.toLowerCase().includes(source.toLowerCase())) && (eventType === 'all' || log.event === eventType) && `${log.message} ${log.event} ${log.sourceIp} ${log.destinationIp} ${log.assetId ?? ''}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [logs, query, severity, source, eventType]);
  const unseen = snapshot ? state.logs.filter(log => !snapshot.some(previous => previous.id === log.id)).length : 0;

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setImportError('');
    if (!/\.(json|jsonl)$/i.test(file.name)) { setImportError('Choose a .json or .jsonl file.'); event.target.value = ''; return; }
    if (file.size > 2 * 1024 * 1024) { setImportError('Choose a file smaller than 2 MB.'); event.target.value = ''; return; }
    try { setImportText(await file.text()); setFileName(file.name); }
    catch { setImportError('The file could not be read. Try pasting its contents.'); }
    event.target.value = '';
  }
  async function importLogs() {
    setImporting(true); setImportError('');
    try {
      const result = await api<{ imported: number; alertsCreated: number }>('/logs/import', { text: importText });
      await refresh(); notify(`Imported ${result.imported} events. ${result.alertsCreated} alert${result.alertsCreated === 1 ? '' : 's'} created.`);
      setImportOpen(false); setImportText(''); setFileName('');
    } catch (error) { setImportError(errorMessage(error)); }
    finally { setImporting(false); }
  }
  function sampleDownload() {
    const now = Date.now();
    const sample = Array.from({ length: 5 }, (_, index) => ({ timestamp: new Date(now - (4 - index) * 60000).toISOString(), severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.0.1.10', event: 'failed_login', message: `Failed SSH authentication for test-user (attempt ${index + 1})`, protocol: 'TCP', port: 22, vpn: false }));
    downloadText(sample.map(log => JSON.stringify(log)).join('\n'), 'aegis-sample-events.jsonl', 'application/x-ndjson');
  }
  function exportCsv() {
    const rows = [['timestamp', 'severity', 'sourceIp', 'destinationIp', 'event', 'message', 'origin'], ...filtered.map(log => [log.timestamp, log.severity, log.sourceIp, log.destinationIp, log.event, log.message, log.origin])];
    downloadText(rows.map(row => row.map(csvCell).join(',')).join('\r\n'), `aegis-events-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    notify(`Exported ${filtered.length} filtered events.`);
  }
  return <div className="mon-page">
    <PageHeading eyebrow="OBSERVABILITY / EVENT STREAM" title="Security logs" description="The detail behind every detection." action={<div className="mon-heading-actions"><button className="btn secondary" onClick={exportCsv} disabled={!filtered.length}><ArrowDownToLine size={15} /> Export CSV</button><button className="btn primary" onClick={() => { setImportOpen(true); setImportError(''); }}><FileUp size={15} /> Import logs</button></div>} />
    <div className="mon-log-banner"><div className="mon-log-banner-icon"><Terminal size={22} /></div><div><span className="mon-label">EVENT PIPELINE</span><strong>Every event. A clearer picture.</strong><p>Search the stream or bring your own JSON logs into the detection engine.</p></div><div className="mon-log-banner-number"><strong>{logs.length.toLocaleString()}</strong><span>EVENTS IN VIEW</span></div><div className="mon-log-banner-line" /><div className="mon-log-banner-number"><strong>{logs.filter(log => log.severity === 'critical' || log.severity === 'high').length.toLocaleString()}</strong><span>HIGH PRIORITY</span></div></div>
    <section className="panel mon-panel mon-logs-panel"><div className="mon-section-heading"><div><h2><Activity size={17} /> Event stream <span className={`mon-stream-tag ${snapshot ? 'mon-stream-paused' : ''}`}><i />{snapshot ? 'PAUSED' : 'LIVE'}</span></h2><p>{snapshot ? `View paused. ${unseen} new event${unseen === 1 ? '' : 's'} received in the background.` : 'Updates from server events · newest first'}</p></div><button className="btn secondary mon-pause-button" onClick={() => setSnapshot(snapshot ? null : [...state.logs])}>{snapshot ? <Play size={13} /> : <Pause size={13} />}{snapshot ? 'Resume stream' : 'Pause view'}</button></div>
      <div className="mon-toolbar mon-logs-toolbar"><div className="mon-search-input"><Search size={16} /><input aria-label="Search logs" placeholder="Search events, messages, destinations…" value={query} onChange={event => setQuery(event.target.value)} /></div><label className="mon-filter"><span>Severity</span><select aria-label="Filter log severity" value={severity} onChange={event => setSeverity(event.target.value)}><option value="all">All levels</option>{severities.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label><label className="mon-filter"><span>Event</span><select aria-label="Filter event type" value={eventType} onChange={event => setEventType(event.target.value)}><option value="all">All events</option>{eventTypes.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label></div>
      <div className="mon-subfilters"><label><Globe2 size={13} /><input aria-label="Filter source IP" placeholder="Filter by source IP…" value={source} onChange={event => setSource(event.target.value)} /></label><span>{filtered.length} matching event{filtered.length === 1 ? '' : 's'}{(query || source || severity !== 'all' || eventType !== 'all') && <button onClick={() => { setQuery(''); setSource(''); setSeverity('all'); setEventType('all'); }}>Clear filters</button>}</span></div>
      <div className="table-wrap"><table className="data-table mon-logs-table"><thead><tr><th>Timestamp · IST <span>↓</span></th><th>Severity</th><th>Source → destination</th><th>Event / message</th><th>Origin</th><th aria-label="Actions" /></tr></thead><tbody>{filtered.slice(0, 250).map(log => <tr key={log.id}><td className="mono mon-log-time"><span>{timeOnly(log.timestamp)}</span><small>{new Date(log.timestamp).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })}</small></td><td><span className={`badge ${log.severity}`}><i />{log.severity}</span></td><td><div className="mon-address-pair"><span className="mono">{log.sourceIp}</span><span className="mono"><ArrowRight size={10} />{log.destinationIp}</span></div></td><td><button className="mon-event-button" onClick={() => setSelected(log)}>{log.event.replaceAll('_', ' ')}{log.vpn && <span className="mon-vpn-tag">VPN</span>}</button><p className="mon-event-message" title={log.message}>{log.message}</p></td><td><OriginBadge origin={log.origin} /></td><td><button className="mon-row-button" aria-label={`View event ${log.id}`} onClick={() => setSelected(log)}><ChevronRight size={16} /></button></td></tr>)}</tbody></table></div>{!filtered.length && <Empty title="No events match these filters" detail="Adjust your search or import new logs to explore more activity." />}<div className="mon-table-footer"><span><span className={`mon-live-dot ${snapshot ? 'mon-paused-dot' : ''}`} /> {snapshot ? 'Snapshot retained while paused' : 'Listening for server updates'}</span><span>{filtered.length > 250 ? `Showing newest 250 of ${filtered.length} · CSV includes all matches` : `${filtered.length} events · click a row title for evidence`}</span></div>
    </section>
    <p className="mon-data-note"><ShieldCheck size={13} /> Sample, imported and local lab events are explicitly labeled. Imported logs are stored on this server.</p>
    {selected && <Modal title="Event evidence" onClose={() => setSelected(null)} wide><div className="mon-event-detail-heading"><span className={`badge ${selected.severity}`}>{selected.severity}</span><OriginBadge origin={selected.origin} /><span className="mono muted">{selected.id}</span></div><h3 className="mon-event-detail-title">{selected.event.replaceAll('_', ' ')}</h3><p className="mon-event-detail-message">{selected.message}</p><dl className="mon-detail-grid"><div><dt>Timestamp</dt><dd className="mono">{selected.timestamp}</dd></div><div><dt>Asset</dt><dd>{selected.assetId ?? 'Not associated'}</dd></div><div><dt>Source address</dt><dd className="mono">{selected.sourceIp}</dd></div><div><dt>Destination address</dt><dd className="mono">{selected.destinationIp}</dd></div><div><dt>Protocol / port</dt><dd className="mono">{selected.protocol ?? '—'} / {selected.port ?? '—'}</dd></div><div><dt>VPN tag</dt><dd>{selected.vpn ? 'Explicitly tagged as VPN' : 'Not tagged'}</dd></div></dl><details className="mon-raw-event"><summary>Raw event record</summary><pre>{JSON.stringify(selected, null, 2)}</pre></details><div className="mon-modal-footer"><span className="muted">Record from the current server dataset</span><button className="btn secondary" onClick={() => setSelected(null)}>Close evidence</button></div></Modal>}
    {importOpen && <Modal title="Import security logs" onClose={() => { if (!importing) setImportOpen(false); }} wide><p className="mon-modal-intro">Bring your own events into the stream. Valid records are stored on this server and checked for repeated failed logins.</p><label className="mon-file-drop"><span className="mon-upload-icon"><Upload size={22} /></span><strong>{fileName || 'Choose a JSON or JSONL file'}</strong><span>Up to 2 MB · or paste your records below</span><input type="file" accept=".json,.jsonl,application/json,application/x-ndjson" aria-label="Choose log file" disabled={importing} onChange={event => void readFile(event)} /></label><div className="mon-import-text-heading"><label className="mon-label" htmlFor="import-logs-text">JSON ARRAY OR ONE OBJECT PER LINE</label><button className="mon-text-button" onClick={sampleDownload}><ArrowDownToLine size={13} /> Download sample</button></div><textarea className="textarea mon-import-text" id="import-logs-text" value={importText} maxLength={2 * 1024 * 1024} disabled={importing} onChange={event => { setImportText(event.target.value); setImportError(''); setFileName(''); }} spellCheck={false} placeholder={'{"timestamp":"2026-01-01T12:00:00Z","severity":"medium","sourceIp":"203.0.113.45","destinationIp":"10.0.1.10","event":"failed_login","message":"Failed SSH login"}'} /><div className="mon-import-help"><AlertTriangle size={15} /><div><strong>Import only logs you are authorized to use.</strong><p>Required: timestamp (ISO 8601 with timezone), severity, sourceIp, destinationIp, event and message. Optional: assetId, protocol, port and vpn. Do not include id or origin. Five <code>failed_login</code> events from one source within 10 minutes create a detection.</p></div></div><ErrorNote message={importError} /><div className="mon-modal-footer"><span><LockKeyhole size={13} /> Stored locally after import</span><div><button className="btn secondary" disabled={importing} onClick={() => setImportOpen(false)}>Cancel</button><button className="btn primary" disabled={importing || !importText.trim()} onClick={() => void importLogs()}><FileUp size={15} />{importing ? 'Importing…' : 'Validate & import'}</button></div></div></Modal>}
  </div>;
}
