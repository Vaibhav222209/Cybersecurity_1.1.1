import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, BookOpenCheck, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Command, Crosshair, FileChartColumn, Fingerprint, Globe2, Layers3, LayoutDashboard, Menu, Monitor, Network, Radio, RefreshCw, Search, Server, ShieldCheck, ShieldOff, Siren, Terminal, TriangleAlert, X, Zap } from 'lucide-react';
import type { AppState, Asset, Page, PageProps, ThreatAlert } from './types';
import { api, errorMessage } from './lib/api';
import Modal from './components/Modal';
import Dashboard from './components/Dashboard';
import { AssetsPage, IntelligencePage, LogsPage } from './components/Monitoring';
import { AttackLabPage, NetworkPage, ReconPage, ReportsPage, ResponsePage } from './components/Operations';
import { NistPage, QuizPage } from './components/Governance';

const navigation: { id: Page; name: string; icon: LucideIcon; group: string; title: string; subtitle: string }[] = [
  { id: 'overview', name: 'Overview', icon: LayoutDashboard, group: 'MONITOR', title: 'Security overview', subtitle: 'The bigger picture. Every signal, in one place.' },
  { id: 'intelligence', name: 'Threat intelligence', icon: Globe2, group: 'MONITOR', title: 'Threat intelligence', subtitle: 'Connect suspicious IPs, VPN activity, and phishing signals.' },
  { id: 'assets', name: 'Assets & endpoints', icon: Layers3, group: 'MONITOR', title: 'Assets & endpoints', subtitle: 'Know your environment. Find the assets that need attention.' },
  { id: 'network', name: 'Network & TCP', icon: Network, group: 'MONITOR', title: 'Network & TCP', subtitle: 'Understand the conversations behind every connection.' },
  { id: 'logs', name: 'Logs & events', icon: Terminal, group: 'MONITOR', title: 'Logs & events', subtitle: 'Follow the evidence through your event stream.' },
  { id: 'recon', name: 'Reconnaissance', icon: Crosshair, group: 'OPERATE', title: 'Reconnaissance', subtitle: 'Explore your attack surface in a scoped, local TCP lab.' },
  { id: 'lab', name: 'Attack simulation', icon: Zap, group: 'OPERATE', title: 'Attack simulation lab', subtitle: 'Follow an attack path. Learn where a defense makes the difference.' },
  { id: 'response', name: 'Containment & firewall', icon: ShieldOff, group: 'OPERATE', title: 'Containment & firewall', subtitle: 'Make a measured response. Keep a complete audit trail.' },
  { id: 'reports', name: 'Incident reports', icon: FileChartColumn, group: 'OPERATE', title: 'Incident reports', subtitle: 'Turn the investigation into a clear, evidence-based story.' },
  { id: 'nist', name: 'NIST framework', icon: ShieldCheck, group: 'GOVERN', title: 'NIST CSF 2.0', subtitle: 'Govern. Identify. Protect. Detect. Respond. Recover.' },
  { id: 'quiz', name: 'Knowledge check', icon: BookOpenCheck, group: 'GOVERN', title: 'Test your cyber instincts', subtitle: 'Five questions. Five opportunities to sharpen your judgment.' },
];
const pageComponents: Record<Page, (props: PageProps) => React.ReactNode> = { overview: Dashboard, intelligence: IntelligencePage, assets: AssetsPage, network: NetworkPage, logs: LogsPage, recon: ReconPage, lab: AttackLabPage, response: ResponsePage, reports: ReportsPage, nist: NistPage, quiz: QuizPage };
const getPage = (): Page => { const value = window.location.hash.replace(/^#\/?/, ''); return navigation.some(item => item.id === value) ? value as Page : 'overview'; };

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [apiError, setApiError] = useState('');
  const [streamConnected, setStreamConnected] = useState(false);
  const [page, setPage] = useState<Page>(getPage);
  const [navOpen, setNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [assetId, setAssetId] = useState<string | null>(null);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    try { const next = await api<AppState>('/state'); setState(next); setApiError(''); }
    catch (error) { setApiError(errorMessage(error)); throw error; }
  }, []);
  const notify = useCallback((message: string, tone: 'success' | 'error' = 'success') => setToast({ message, tone }), []);
  const navigate = useCallback((next: Page) => { setPage(next); setNavOpen(false); window.location.hash = `/${next}`; window.scrollTo({ top: 0 }); }, []);
  const openAsset = useCallback((asset: Asset) => setAssetId(asset.id), []);
  const openAlert = useCallback((alert: ThreatAlert) => setAlertId(alert.id), []);

  useEffect(() => {
    void refresh().catch(() => {});
    const events = new EventSource('/api/events');
    events.onopen = () => setStreamConnected(true);
    events.onerror = () => setStreamConnected(false);
    events.addEventListener('state', () => { void refresh().catch(() => {}); });
    const timer = setInterval(() => { void refresh().catch(() => {}); }, 15_000);
    return () => { events.close(); clearInterval(timer); };
  }, [refresh]);
  useEffect(() => { const handler = () => { setPage(getPage()); setNavOpen(false); window.scrollTo({ top: 0 }); }; window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  useEffect(() => { const media = window.matchMedia('(max-width: 900px)'); const handler = () => setIsMobile(media.matches); media.addEventListener('change', handler); return () => media.removeEventListener('change', handler); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if ((event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key === 'k')) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable && !document.querySelector('dialog[open]')) { event.preventDefault(); setQuery(''); setSearchOpen(true); }
      if (event.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
  }, []);

  const meta = navigation.find(item => item.id === page)!;
  const ActivePage = pageComponents[page];
  const selectedAsset = state?.assets.find(asset => asset.id === assetId);
  const selectedAlert = state?.alerts.find(alert => alert.id === alertId);
  const activeCount = state?.alerts.filter(alert => alert.status === 'open' || alert.status === 'investigating').length ?? 0;
  const props: PageProps | null = state ? { state, refresh, notify, navigate, openAsset, openAlert } : null;
  const searchResults = [
    ...navigation.map(item => ({ id: item.id, title: item.name, subtitle: 'Workspace', icon: item.icon, action: () => navigate(item.id) })),
    ...(state?.assets.map(asset => ({ id: asset.id, title: asset.name, subtitle: `${asset.ip} · ${asset.kind}`, icon: asset.kind === 'workstation' ? Monitor : Server, action: () => openAsset(asset) })) ?? []),
    ...(state?.alerts.map(alert => ({ id: alert.id, title: alert.title, subtitle: `${alert.sourceIp} · ${alert.severity}`, icon: Siren, action: () => openAlert(alert) })) ?? []),
  ].filter(item => `${item.title} ${item.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()));

  const refreshManually = async () => { setRefreshing(true); try { await refresh(); notify('Workspace telemetry refreshed.'); } catch (error) { notify(errorMessage(error), 'error'); } finally { setRefreshing(false); } };
  const resetDemo = async () => {
    setRefreshing(true);
    try { await api('/demo/reset', { confirm: confirmReset }); await refresh(); setSettingsOpen(false); setConfirmReset(''); notify('Workspace reset to the original sample environment.'); }
    catch (error) { notify(errorMessage(error), 'error'); } finally { setRefreshing(false); }
  };

  return <div className="application">
    <a className="skip-link" href="#content" onClick={event => { event.preventDefault(); document.getElementById('content')?.focus(); document.getElementById('content')?.scrollIntoView(); }}>Skip to content</a>
    {navOpen && <button className="navigation-overlay" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
    <aside className={`sidebar ${navOpen ? 'sidebar-open' : ''}`} inert={isMobile && !navOpen}>
      <a className="brand" href="#/overview" onClick={() => setNavOpen(false)} aria-label="AEGIS overview"><BrandMark /><span>AEGIS<small>CYBER DEFENSE PLATFORM</small></span></a>
      <button className="workspace-switch" onClick={() => { setConfirmReset(''); setSettingsOpen(true); }}><span className="workspace-avatar"><Command size={17} /></span><span>Personal workspace<small>Local operations center</small></span><ChevronDown size={13} /></button>
      <nav aria-label="Main navigation">{['MONITOR', 'OPERATE', 'GOVERN'].map(group => <div className="nav-group" key={group}><span className="nav-group-label">{group}</span>{navigation.filter(item => item.group === group).map(({ id, name, icon: Icon }) => <a href={`#/${id}`} key={id} className={`nav-link ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => setNavOpen(false)}><Icon size={16} strokeWidth={1.65} /><span>{name}</span>{id === 'intelligence' && activeCount > 0 ? <span className="nav-count">{activeCount}</span> : page === id ? <span className="nav-active-dot" /> : null}</a>)}</div>)}</nav>
      <div className="sidebar-bottom"><button className="framework-card" onClick={() => navigate('nist')}><span className="framework-card-icon"><ShieldCheck size={22} /></span><span>Built on a stronger standard.<small>NIST Cybersecurity Framework 2.0</small></span><ArrowUpRight size={14} /></button><div className="sidebar-system"><span className="pulse-dot" /><span>LOCAL SIMULATION</span><span className="mono">v1.0</span></div><div className="creator-credit">Made by <strong>Vaibhav Thakur</strong></div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Menu size={21} /></button><span className="breadcrumb">Workspace<ChevronRight size={12} /><strong>{meta.name}</strong></span></div><div className="topbar-right"><button className="search-trigger" onClick={() => { setQuery(''); setSearchOpen(true); }}><Search size={15} /><span>Search your workspace</span><kbd>⌘ K</kbd></button><span className="topbar-separator" /><span className={`connection-badge ${state && !apiError ? 'connected' : ''}`}><span className="tiny-dot" />{apiError ? 'API disconnected' : streamConnected ? 'Stream connected' : state ? 'API connected' : 'Connecting'}</span><button className="icon-button notification-button" aria-label={`View ${activeCount} active detections`} onClick={() => navigate('intelligence')}><Bell size={17} />{activeCount > 0 && <span />}</button><button className="profile-avatar" onClick={() => setHelpOpen(true)} aria-label="About AEGIS and Vaibhav Thakur">VT</button></div></header>
      <main className="main-content" id="content" tabIndex={-1}>
        <div className="page-header"><div><div className="page-context"><span className="tiny-dot cyan" />AEGIS OPERATIONS CENTER<span>/</span><span>{meta.group}</span></div><h1>{meta.title}<span className="title-period">.</span></h1><p>{meta.subtitle}</p></div><div className="page-header-actions"><span className="simulation-label"><span className="tiny-dot amber" />SIMULATION MODE</span><button className={`btn secondary compact refresh-button ${refreshing ? 'is-refreshing' : ''}`} onClick={refreshManually} disabled={refreshing} aria-label="Refresh telemetry"><RefreshCw size={13} /><span>Refresh</span></button><button className="btn secondary compact report-header-button" onClick={() => navigate('reports')}><ArrowDownToLine size={13} />Export report</button></div></div>
        {apiError && <div className="api-error" role="alert"><TriangleAlert size={18} /><span><strong>Local API is unavailable.</strong> {apiError}. Start the backend to reconnect. Existing data may be out of date.</span><button onClick={refreshManually}>Retry<RefreshCw size={13} /></button></div>}
        {props ? <ActivePage {...props} /> : <section className="loading-panel"><span className="loader" /><h2>{apiError ? 'Waiting for the local API' : 'Connecting the signals'}</h2><p>{apiError ? 'Run npm run dev from the project directory to start both services.' : 'Loading your operations workspace…'}</p>{apiError && <button className="btn primary" onClick={refreshManually}>Try again<ArrowRight size={14} /></button>}</section>}
        <footer className="main-footer"><span><ShieldCheck size={13} />Built for investigation. Designed for clarity.</span><span className="footer-mode">Sample telemetry + local lab<span>·</span>Made by <strong>Vaibhav Thakur</strong></span><button onClick={() => setHelpOpen(true)}>About this workspace<CircleHelp size={12} /></button></footer>
      </main>
    </div>

    {searchOpen && <Modal title="Search your workspace" onClose={() => setSearchOpen(false)}><div className="search-field"><Search size={18} /><input value={query} autoFocus aria-label="Search assets, IPs, and pages" placeholder="An asset, IP address, or next step…" onChange={event => setQuery(event.target.value)} />{query && <button className="icon-button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</div><div className="search-results">{searchResults.length ? searchResults.slice(0, 15).map(item => <button key={item.id} onClick={() => { setSearchOpen(false); item.action(); }}><span className="search-result-icon"><item.icon size={17} /></span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><ArrowUpRight size={14} /></button>) : <div className="empty-state"><Search size={26} /><h3>No signals found.</h3><p>Try an asset name, an IP address, or “containment”.</p></div>}</div><div className="search-hint mono">ESC TO CLOSE<span>SEARCH YOUR LOCAL WORKSPACE</span></div></Modal>}
    {selectedAsset && <AssetDetail asset={selectedAsset} state={state!} onClose={() => setAssetId(null)} refresh={refresh} notify={notify} openAlert={openAlert} />}
    {selectedAlert && <AlertDetail alert={selectedAlert} asset={state?.assets.find(asset => asset.id === selectedAlert.targetId)} onClose={() => setAlertId(null)} refresh={refresh} notify={notify} onAsset={() => { setAlertId(null); if (selectedAlert.targetId) setAssetId(selectedAlert.targetId); }} />}
    {helpOpen && <Modal title="AEGIS / Cyber Defense Platform" onClose={() => setHelpOpen(false)}><div className="about-banner"><BrandMark /><span>A sharper lens.<small>Made by Vaibhav Thakur</small></span></div><p className="about-intro">A local cybersecurity operations lab for understanding threats, practicing response, and documenting the investigation.</p><div className="about-facts"><p><Globe2 size={18} /><span><strong>Visible scope.</strong> Enterprise assets and telemetry are simulated. Imported log events are labeled separately and analyzed locally.</span></p><p><Crosshair size={18} /><span><strong>Real local connections.</strong> Reconnaissance makes TCP connections only to the built-in loopback lab’s allowed ports.</span></p><p><ShieldOff size={18} /><span><strong>Contained practice.</strong> Exploitation, privilege escalation, command-and-control, firewall rules, and isolation use a simulation model.</span></p><p><Fingerprint size={18} /><span><strong>Your local data.</strong> Operational state is stored on this machine. No threat feed, VPN identity service, or external endpoint agent is connected.</span></p></div><button className="btn primary" onClick={() => setHelpOpen(false)}>Enter the workspace<ArrowRight size={14} /></button></Modal>}
    {settingsOpen && <Modal title="Local workspace settings" onClose={() => setSettingsOpen(false)}><div className="workspace-settings"><div className="settings-mode"><span className="settings-icon"><Command size={25} /></span><div><h3>Personal operations center</h3><p>Simulation mode • local API • persistent state</p></div></div><p>Imports, analyst actions, firewall policies, quiz attempts, and NIST assessments are stored in the local backend. Export a report to keep a record before resetting.</p><button className="btn secondary" onClick={() => { setSettingsOpen(false); navigate('reports'); }}><FileChartColumn size={15} />Open incident reports<ArrowUpRight size={14} /></button><div className="reset-section"><h3>Reset the sample environment</h3><p>This clears imported logs, actions, watchlists, scan history, quiz attempts, and control assessments, then restores the original sample data.</p><label className="field">Type RESET to confirm<input className="input" value={confirmReset} onChange={event => setConfirmReset(event.target.value)} placeholder="RESET" autoComplete="off" /></label><button className="btn danger" disabled={confirmReset !== 'RESET' || refreshing} onClick={resetDemo}>Reset workspace</button></div></div></Modal>}
    {toast && <div className={`toast ${toast.tone}`} role="status">{toast.tone === 'success' ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}<span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}
  </div>;
}

function BrandMark() { return <span className="brand-mark"><svg viewBox="0 0 38 42" aria-hidden="true"><path d="m19 2 16 7v13c0 8-6 14-16 18C9 36 3 30 3 22V9Z" fill="#61dec711" stroke="currentColor" strokeWidth="1.5" /><path d="m11 27 8-16 8 16m-12-6h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>; }

function AssetDetail({ asset, state, onClose, refresh, notify, openAlert }: { asset: Asset; state: AppState; onClose: () => void; refresh: () => Promise<void>; notify: PageProps['notify']; openAlert: PageProps['openAlert'] }) {
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const related = state.alerts.filter(alert => alert.targetId === asset.id);
  const act = async (action: 'isolate' | 'release' | 'investigate') => { setBusy(true); try { await api(`/assets/${asset.id}/action`, { action, reason }); await refresh(); setReason(''); notify(`${asset.name}: ${action === 'isolate' ? 'simulated isolation applied' : action === 'release' ? 'returned to the simulated network' : 'investigation note recorded'}.`); } catch (error) { notify(errorMessage(error), 'error'); } finally { setBusy(false); } };
  return <Modal title="Asset investigation" onClose={onClose} wide><div className="detail-asset-heading"><span className="asset-large-icon">{asset.kind === 'workstation' ? <Monitor size={28} /> : <Server size={28} />}</span><div><span className="eyebrow">{asset.kind.toUpperCase()} / {asset.zone.toUpperCase()}</span><h3>{asset.name}</h3><span className="mono muted">{asset.ip}</span></div><span className={`badge ${asset.status === 'isolated' ? 'medium' : asset.status === 'investigating' ? 'high' : 'low'}`}>{asset.status}</span></div><div className="detail-facts"><div><span>OPERATING SYSTEM</span><strong>{asset.os}</strong></div><div><span>ASSET OWNER</span><strong>{asset.owner}</strong></div><div><span>RISK SCORE</span><strong className={asset.risk >= 70 ? 'text-red' : 'text-cyan'}>{asset.risk} / 100</strong></div><div><span>DATA SOURCE</span><strong>{asset.origin} telemetry</strong></div></div><div className="detail-tags">{asset.tags.map(tag => <span className="label-chip" key={tag}>{tag}</span>)}</div><h4 className="detail-section-title">Observed services</h4><div className="service-chips">{asset.services.map(service => <span key={`${service.port}${service.protocol}`}><span className="tiny-dot cyan" /><strong className="mono">{service.port}/{service.protocol}</strong>{service.service}</span>)}</div><h4 className="detail-section-title">Related detections <span>{related.length}</span></h4><div className="detail-alert-list">{related.length ? related.map(alert => <button key={alert.id} onClick={() => { onClose(); openAlert(alert); }}><span className={`tiny-dot ${alert.severity === 'critical' || alert.severity === 'high' ? 'red' : 'amber'}`} /><span>{alert.title}</span><span className={`badge ${alert.severity}`}>{alert.severity}</span><ArrowUpRight size={14} /></button>) : <p className="muted">No detections are linked to this asset.</p>}</div><div className="containment-box"><div><ShieldOff size={18} /><h4>Containment controls</h4><span className="badge info">SIMULATION</span></div><p>Isolate this asset in the local model, preserve an analyst note, or return it to service. Actions are recorded in the operations journal.</p><label className="field">Investigation note<input className="input" value={reason} onChange={event => setReason(event.target.value)} placeholder="Describe the evidence and reason for this action…" /></label><div className="containment-buttons"><button className="btn secondary" disabled={reason.trim().length < 5 || busy} onClick={() => act('investigate')}><Search size={14} />Investigate</button>{asset.status === 'isolated' ? <button className="btn primary" disabled={reason.trim().length < 5 || busy} onClick={() => act('release')}><Radio size={14} />Release asset</button> : <button className="btn danger" disabled={reason.trim().length < 5 || busy} onClick={() => act('isolate')}><ShieldOff size={14} />Isolate asset</button>}</div></div></Modal>;
}

function AlertDetail({ alert, asset, onClose, refresh, notify, onAsset }: { alert: ThreatAlert; asset?: Asset; onClose: () => void; refresh: () => Promise<void>; notify: PageProps['notify']; onAsset: () => void }) {
  const [busy, setBusy] = useState(false);
  const update = async (status: ThreatAlert['status']) => { setBusy(true); try { await api(`/alerts/${alert.id}/status`, { status }); await refresh(); notify(`Detection marked ${status}.`); } catch (error) { notify(errorMessage(error), 'error'); } finally { setBusy(false); } };
  return <Modal title="Detection investigation" onClose={onClose} wide><div className="alert-detail-header"><span className={`badge ${alert.severity}`}>{alert.severity}</span><span className="label-chip">{alert.origin} telemetry</span><span className="mono muted">{alert.id}</span></div><h3 className="alert-detail-title">{alert.title}</h3><p className="detail-description">{alert.description}</p><div className="detail-facts"><div><span>SOURCE IP</span><strong className="mono">{alert.sourceIp}</strong></div><div><span>CATEGORY</span><strong>{alert.category}</strong></div><div><span>CURRENT STATUS</span><strong>{alert.status}</strong></div><div><span>NIST MAPPING</span><strong>{alert.nist}</strong></div></div><h4 className="detail-section-title">Investigation evidence</h4><ul className="evidence-list">{alert.evidence.map((evidence, index) => <li key={index}><span className="mono">{String(index + 1).padStart(2, '0')}</span>{evidence}</li>)}</ul>{asset && <button className="alert-target" onClick={onAsset}><Server size={18} /><span><strong>{asset.name}</strong><small className="mono">{asset.ip} · {asset.kind}</small></span><span className="text-cyan">Inspect asset<ArrowUpRight size={13} /></span></button>}<div className="alert-status-controls"><label className="field">Update detection status<select className="input" aria-label="Detection status" value={alert.status} disabled={busy} onChange={event => update(event.target.value as ThreatAlert['status'])}>{['open', 'investigating', 'contained', 'resolved'].map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label><p>Analyst status updates are tracked in the local audit trail.</p></div></Modal>;
}
