import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, Check, ChevronRight, Clock3,
  Eye, GitBranch, Laptop, Network, Pause, Play, Radio, RotateCcw, Search,
  Server, ShieldCheck, Unplug, X,
} from 'lucide-react';
import type { LogEvent, PageProps } from '../../types';
import './NetworkPage.css';

type Scenario = 'standard' | 'retransmission';
type HandshakePacket = { label: string; detail: string; direction: 'out' | 'in'; sequence: string; dropped?: boolean };

const standardPackets: HandshakePacket[] = [
  { label: 'SYN', detail: 'The client requests a connection and sends its initial sequence number.', direction: 'out', sequence: 'SEQ 1000' },
  { label: 'SYN–ACK', detail: 'The server acknowledges the request and sends its own sequence number.', direction: 'in', sequence: 'SEQ 5000 · ACK 1001' },
  { label: 'ACK', detail: 'The client acknowledges the server. Both endpoints can now exchange application data.', direction: 'out', sequence: 'SEQ 1001 · ACK 5001' },
];
const retransmissionPackets: HandshakePacket[] = [
  standardPackets[0],
  { ...standardPackets[1], detail: 'The server sends SYN–ACK, but this illustrative packet is lost before it reaches the client.', dropped: true },
  { label: 'SYN · retry', detail: 'After its retransmission timer expires, the client resends SYN with the same sequence number.', direction: 'out', sequence: 'SEQ 1000 · RETRANSMIT' },
  { ...standardPackets[1], detail: 'The server replies again. This time, SYN–ACK reaches the client.' },
  standardPackets[2],
];

function eventTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata',
  }).format(date);
}

function provenance(event: LogEvent) {
  return event.origin === 'imported' ? 'Imported' : event.origin === 'lab' ? 'Local lab' : 'Sample';
}

export default function NetworkPage({ state, openAsset }: PageProps) {
  const [scenario, setScenario] = useState<Scenario>('standard');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [search, setSearch] = useState('');
  const [protocol, setProtocol] = useState('all');
  const [origin, setOrigin] = useState('all');
  const [limit, setLimit] = useState(25);
  const packets = scenario === 'standard' ? standardPackets : retransmissionPackets;
  const established = step === packets.length;
  const clientEstablished = packets.slice(0, step).some(packet => packet.direction === 'in' && !packet.dropped);
  const clientState = clientEstablished ? 'ESTABLISHED' : step ? 'SYN-SENT' : 'CLOSED';
  const serverState = established ? 'ESTABLISHED' : step ? 'SYN-RECEIVED' : 'LISTEN';
  const currentPacket = step > 0 ? packets[step - 1] : null;

  useEffect(() => {
    if (!playing || established) return;
    const timer = window.setInterval(() => setStep(current => Math.min(current + 1, packets.length)), 1100);
    return () => window.clearInterval(timer);
  }, [playing, established, packets.length]);
  useEffect(() => { if (established) setPlaying(false); }, [established]);

  const protocols = useMemo(() => [...new Set(state.logs.map(event => event.protocol).filter((value): value is string => Boolean(value)))].sort(), [state.logs]);
  const events = useMemo(() => {
    const term = search.trim().toLowerCase();
    return state.logs.filter(event =>
      (protocol === 'all' || event.protocol === protocol)
      && (origin === 'all' || event.origin === origin)
      && (!term || `${event.event} ${event.message} ${event.sourceIp} ${event.destinationIp} ${event.protocol ?? ''} ${event.port ?? ''}`.toLowerCase().includes(term)),
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.logs, search, protocol, origin]);

  function resetHandshake(nextScenario = scenario) {
    setPlaying(false); setStep(0); setScenario(nextScenario);
  }
  function togglePlayback() {
    if (established) setStep(0);
    setPlaying(!playing);
  }

  return <div className="ops-net-page">
    <div className="ops-net-page-heading">
      <div><span className="ops-net-kicker">OBSERVE / UNDERSTAND</span><h2 className="page-title">Network intelligence</h2><p className="muted">Follow a connection. Understand the signals in your workspace.</p></div>
      <span className="ops-net-mode"><Radio size={14} /> SIMULATED + IMPORTED EVENTS</span>
    </div>

    <div className="ops-net-metrics">
      <article className="panel ops-net-metric"><span className="ops-net-metric-icon"><Activity size={20} /></span><div><span>WORKSPACE EVENTS</span><strong>{state.logs.length.toLocaleString()}</strong><small>Sample, imported, and local lab</small></div></article>
      <article className="panel ops-net-metric"><span className="ops-net-metric-icon ops-net-blue"><Network size={20} /></span><div><span>TCP EVENTS</span><strong>{state.logs.filter(event => event.protocol?.toUpperCase() === 'TCP').length.toLocaleString()}</strong><small>Events labeled with TCP</small></div></article>
      <article className="panel ops-net-metric"><span className="ops-net-metric-icon ops-net-violet"><ShieldCheck size={20} /></span><div><span>VPN-RELATED EVENTS</span><strong>{state.logs.filter(event => event.vpn).length.toLocaleString()}</strong><small>Based on the event’s VPN flag</small></div></article>
    </div>

    <section className="panel ops-net-handshake" aria-labelledby="ops-net-handshake-title">
      <div className="panel-heading ops-net-handshake-heading"><div><span className="ops-net-kicker">PROTOCOL EXPLORER</span><h2 id="ops-net-handshake-title"><GitBranch size={18} /> The TCP three-way handshake</h2><p className="muted">An interactive training diagram. This does not open a network connection.</p></div><span className="badge info">TRAINING VISUALIZATION</span></div>
      <div className="ops-net-handshake-toolbar"><label className="ops-net-scenario"><span>SCENARIO</span><select aria-label="Handshake scenario" value={scenario} onChange={event => resetHandshake(event.target.value as Scenario)}><option value="standard">Successful connection</option><option value="retransmission">Lost packet + retransmission</option></select></label><div className="ops-net-handshake-controls"><button className="btn secondary" onClick={() => resetHandshake()} aria-label="Reset handshake"><RotateCcw size={14} />Reset</button><button className="btn secondary" onClick={() => { setPlaying(false); setStep(current => Math.min(current + 1, packets.length)); }} disabled={established}><ChevronRight size={15} />Next packet</button><button className="btn primary" onClick={togglePlayback}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : established ? 'Replay' : 'Run handshake'}</button></div></div>
      <div className="ops-net-diagram">
        <div className="ops-net-endpoints"><div className="ops-net-endpoint"><span className="ops-net-endpoint-icon"><Laptop size={26} strokeWidth={1.5} /></span><strong>Client</strong><code>192.0.2.10 : 49152</code><span className={clientEstablished ? 'ops-net-state-established' : ''}>{clientState}</span></div><div className="ops-net-protocol-label"><span>TCP / ILLUSTRATIVE ADDRESSES</span><small>Connection-oriented transport</small></div><div className="ops-net-endpoint ops-net-endpoint-server"><span className="ops-net-endpoint-icon"><Server size={26} strokeWidth={1.5} /></span><strong>Server</strong><code>198.51.100.20 : 443</code><span className={established ? 'ops-net-state-established' : ''}>{serverState}</span></div></div>
        <div className="ops-net-packet-lanes" aria-label="Handshake packet sequence">{packets.map((packet, index) => <div className={`ops-net-packet-lane ${step > index ? 'ops-net-packet-sent' : ''} ${step === index + 1 ? 'ops-net-packet-current' : ''} ${packet.direction === 'in' ? 'ops-net-packet-in' : ''} ${packet.dropped ? 'ops-net-packet-dropped' : ''}`} key={`${scenario}-${index}`}><span className="ops-net-lane-guide" /><span className="ops-net-packet-number">0{index + 1}</span><div className="ops-net-packet-line"><span className="ops-net-packet-label">{packet.dropped ? <Unplug size={12} /> : packet.direction === 'in' ? <ArrowLeft size={12} /> : <ArrowRight size={12} />}<strong>{packet.label}</strong><code>{packet.sequence}</code>{packet.dropped && <small>LOST</small>}</span>{packet.direction === 'in' ? <ArrowLeft className="ops-net-lane-arrow" size={17} /> : <ArrowRight className="ops-net-lane-arrow" size={17} />}</div><span className="ops-net-lane-guide" /></div>)}</div>
      </div>
      <div className={`ops-net-handshake-status ${established ? 'ops-net-handshake-complete' : ''}`} role="status"><span className="ops-net-status-icon">{established ? <Check size={18} /> : <Clock3 size={17} />}</span><div><strong>{established ? 'Connection established' : currentPacket ? currentPacket.label : 'Ready to trace a connection'}</strong><p>{currentPacket?.detail ?? 'Run the animation or use Next packet to follow each message between the client and server.'}</p></div><span className="mono">{step.toString().padStart(2, '0')} / {packets.length.toString().padStart(2, '0')}</span></div>
    </section>

    <section className="panel ops-net-events" aria-labelledby="ops-net-events-title">
      <div className="panel-heading ops-net-events-heading"><div><span className="ops-net-kicker">WORKSPACE TRAFFIC RECORDS</span><h2 id="ops-net-events-title"><Activity size={18} /> Network event stream <span className="ops-net-count">{state.logs.length}</span></h2><p className="muted">Event records from the workspace data store. This is not a live packet capture.</p></div></div>
      <div className="ops-net-event-filters"><div className="ops-net-search"><Search size={15} /><input aria-label="Search network events" placeholder="Search events, IP addresses, or ports…" value={search} onChange={event => { setSearch(event.target.value); setLimit(25); }} />{search && <button aria-label="Clear event search" onClick={() => { setSearch(''); setLimit(25); }}><X size={13} /></button>}</div><select aria-label="Filter network protocol" value={protocol} onChange={event => { setProtocol(event.target.value); setLimit(25); }}><option value="all">All protocols</option>{protocols.map(value => <option key={value}>{value}</option>)}</select><select aria-label="Filter event origin" value={origin} onChange={event => { setOrigin(event.target.value); setLimit(25); }}><option value="all">All origins</option><option value="sample">Sample</option><option value="imported">Imported</option><option value="lab">Local lab</option></select></div>
      <div className="table-wrap"><table className="data-table ops-net-table"><thead><tr><th>TIME / IST</th><th>SEVERITY</th><th>CONNECTION</th><th>PROTOCOL</th><th>EVENT</th><th>ORIGIN</th><th><span className="ops-net-action-label">ASSET</span></th></tr></thead><tbody>{events.slice(0, limit).map(event => {
        const asset = state.assets.find(item => item.id === event.assetId)
          ?? state.assets.find(item => item.ip === event.destinationIp)
          ?? state.assets.find(item => item.ip === event.sourceIp);
        return <tr key={event.id}><td className="mono ops-net-time"><time dateTime={event.timestamp} title={event.timestamp}>{eventTime(event.timestamp)}</time></td><td><span className={`badge ${event.severity}`}>{event.severity}</span></td><td><div className="ops-net-connection"><code>{event.sourceIp}</code><ArrowDown size={10} /><code>{event.destinationIp}</code></div></td><td><div className="ops-net-protocol"><span className="mono">{event.protocol ?? '—'}{event.port !== undefined ? `:${event.port}` : ''}</span>{event.vpn && <span className="ops-net-vpn-tag">VPN</span>}</div></td><td><div className="ops-net-event-copy"><strong>{event.event}</strong><span title={event.message}>{event.message}</span></div></td><td><span className={`ops-net-origin ops-net-origin-${event.origin}`}>{provenance(event)}</span></td><td><button className="ops-net-inspect" disabled={!asset} onClick={() => { if (asset) openAsset(asset); }} aria-label={asset ? `Inspect ${asset.name}` : 'No linked asset'} title={asset ? `Inspect ${asset.name}` : 'No linked asset'}><Eye size={15} /></button></td></tr>;
      })}{!events.length && <tr><td colSpan={7}><div className="ops-net-empty"><Search size={26} strokeWidth={1.3} /><strong>No matching network events</strong><p>Try a different search, protocol, or event origin.</p>{(search || protocol !== 'all' || origin !== 'all') && <button className="btn secondary" onClick={() => { setSearch(''); setProtocol('all'); setOrigin('all'); setLimit(25); }}>Clear filters</button>}</div></td></tr>}</tbody></table></div>
      <div className="ops-net-table-footer"><span>Showing <strong>{Math.min(limit, events.length)}</strong> of <strong>{events.length}</strong> matching events</span>{events.length > limit && <button className="btn secondary" onClick={() => setLimit(current => current + 25)}>Load more events<ChevronRight size={13} /></button>}<span className="ops-net-stream-note"><span />Data provenance preserved</span></div>
    </section>
  </div>;
}
