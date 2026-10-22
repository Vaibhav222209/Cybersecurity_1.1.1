import type { AppState, Asset, LogEvent, NistControl, ThreatAlert } from './types';

/** A reproducible, clearly modeled workspace. No seed entry is live telemetry. */
export function createSeedState(now: Date = new Date()): AppState {
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const assets: Asset[] = [
    {
      id: 'ast-01', name: 'WEB-PROD-01', ip: '10.24.1.10', kind: 'server', os: 'Ubuntu 22.04 LTS',
      zone: 'DMZ', status: 'online', risk: 82, lastSeen: at(1), owner: 'Web platform',
      services: [{ port: 443, protocol: 'TCP', service: 'HTTPS' }, { port: 22, protocol: 'TCP', service: 'SSH' }],
      tags: ['Production', 'Internet-facing'], origin: 'sample',
    },
    {
      id: 'ast-02', name: 'DB-CORE-01', ip: '10.24.2.20', kind: 'server', os: 'Ubuntu 24.04 LTS',
      zone: 'Data', status: 'online', risk: 34, lastSeen: at(1), owner: 'Data platform',
      services: [{ port: 5432, protocol: 'TCP', service: 'PostgreSQL' }],
      tags: ['Production', 'Restricted'], origin: 'sample',
    },
    {
      id: 'ast-03', name: 'AD-CTRL-01', ip: '10.24.3.10', kind: 'server', os: 'Windows Server 2022',
      zone: 'Identity', status: 'online', risk: 64, lastSeen: at(2), owner: 'Identity team',
      services: [{ port: 636, protocol: 'TCP', service: 'LDAPS' }, { port: 88, protocol: 'TCP', service: 'Kerberos' }],
      tags: ['Identity', 'Critical'], origin: 'sample',
    },
    {
      id: 'ast-04', name: 'WS-FIN-014', ip: '10.24.4.14', kind: 'workstation', os: 'Windows 11',
      zone: 'Corporate', status: 'investigating', risk: 91, lastSeen: at(1), owner: 'Finance',
      services: [], tags: ['Managed', 'Priority review'], origin: 'sample',
    },
    {
      id: 'ast-05', name: 'VPN-GATEWAY', ip: '10.24.0.1', kind: 'gateway', os: 'Virtual security gateway',
      zone: 'Edge', status: 'online', risk: 76, lastSeen: at(0), owner: 'Network operations',
      services: [{ port: 443, protocol: 'TCP', service: 'SSL VPN' }],
      tags: ['Remote access', 'Critical'], origin: 'sample',
    },
    {
      id: 'ast-06', name: 'FILE-SRV-01', ip: '10.24.2.30', kind: 'server', os: 'Ubuntu 24.04 LTS',
      zone: 'Data', status: 'online', risk: 28, lastSeen: at(3), owner: 'IT operations',
      services: [{ port: 445, protocol: 'TCP', service: 'SMB' }],
      tags: ['Internal', 'Backed up'], origin: 'sample',
    },
    {
      id: 'ast-07', name: 'WS-ENG-007', ip: '10.24.4.7', kind: 'workstation', os: 'Ubuntu 24.04 LTS',
      zone: 'Corporate', status: 'online', risk: 19, lastSeen: at(2), owner: 'Engineering',
      services: [], tags: ['Managed', 'Developer'], origin: 'sample',
    },
    {
      id: 'ast-08', name: 'DNS-RESOLVER', ip: '10.24.0.53', kind: 'server', os: 'Debian 12',
      zone: 'Infrastructure', status: 'online', risk: 22, lastSeen: at(0), owner: 'Network operations',
      services: [{ port: 53, protocol: 'UDP', service: 'DNS' }, { port: 53, protocol: 'TCP', service: 'DNS' }],
      tags: ['Internal', 'Infrastructure'], origin: 'sample',
    },
  ];

  const alerts: ThreatAlert[] = [
    {
      id: 'alt-01', title: 'Repeated outbound beacon pattern', severity: 'critical', status: 'open', category: 'Endpoint',
      sourceIp: '198.51.100.23', targetId: 'ast-04', timestamp: at(3),
      description: 'Sample endpoint telemetry shows repeated connections to a documentation-range destination at regular intervals. This is a detection exercise, not evidence from a real device.',
      evidence: ['Modeled destination: 198.51.100.23:443', 'Six sample connections spaced 60 seconds apart', 'Associated sample asset: WS-FIN-014'],
      nist: 'DE.CM-01', origin: 'sample',
    },
    {
      id: 'alt-02', title: 'Suspicious VPN authentication sequence', severity: 'critical', status: 'open', category: 'VPN',
      sourceIp: '203.0.113.45', targetId: 'ast-05', timestamp: at(6),
      description: 'The sample dataset contains repeated VPN sign-in failures followed by an explicitly flagged unusual session. Review account activity and verify the user through an independent route.',
      evidence: ['Five failed sample VPN authentication events', 'Unusual-session flag present in sample telemetry', 'No real VPN provider is connected'],
      nist: 'DE.AE-02', origin: 'sample',
    },
    {
      id: 'alt-03', title: 'Burst of failed account sign-ins', severity: 'high', status: 'investigating', category: 'Authentication',
      sourceIp: '203.0.113.45', targetId: 'ast-03', timestamp: at(8),
      description: 'Six sample authentication failures share a source address within a ten-minute window. A burst warrants review but does not by itself prove an account compromise.',
      evidence: ['Source: 203.0.113.45', 'Target: AD-CTRL-01', 'Sample correlation: 6 failed_login events / 10 minutes'],
      nist: 'DE.AE-02', origin: 'sample',
    },
    {
      id: 'alt-04', title: 'Unexpected privileged role change', severity: 'high', status: 'open', category: 'Endpoint',
      sourceIp: '10.24.4.14', targetId: 'ast-03', timestamp: at(12),
      description: 'A modeled identity event records an administrative role assignment outside the sample change window. Confirm authorization before taking response action.',
      evidence: ['Sample event: privilege_change', 'Change-window flag: outside approved hours', 'Authorization has not been established'],
      nist: 'PR.AA-01', origin: 'sample',
    },
    {
      id: 'alt-05', title: 'Firewall denied repeated SSH attempts', severity: 'medium', status: 'contained', category: 'Network',
      sourceIp: '198.51.100.88', targetId: 'ast-01', timestamp: at(180),
      description: 'The sample network feed records denied TCP/22 attempts against the modeled web server. The firewall shown here is a simulator and does not enforce host-network policy.',
      evidence: ['Sample destination: 10.24.1.10:22', 'Modeled action: deny', 'Real operating system firewall unchanged'],
      nist: 'DE.CM-01', origin: 'sample',
    },
    {
      id: 'alt-06', title: 'Reported credential-themed email', severity: 'medium', status: 'open', category: 'Phishing',
      sourceIp: '203.0.113.74', targetId: 'ast-04', timestamp: at(540),
      description: 'A sample user report describes an urgent sign-in request. This entry contains no fetched email or live URL; validate reported messages through approved channels.',
      evidence: ['Sample event: phishing_reported', 'Theme: urgent account verification', 'Attachment and link were not opened'],
      nist: 'DE.AE-02', origin: 'sample',
    },
    {
      id: 'alt-07', title: 'Backup recovery check awaiting review', severity: 'low', status: 'resolved', category: 'Endpoint',
      sourceIp: '10.24.2.30', targetId: 'ast-06', timestamp: at(1260),
      description: 'The sample backup job completed and its modeled recovery-check notification was acknowledged. This is not a verification of a real backup or restore.',
      evidence: ['Sample event: backup_verified', 'Modeled acknowledgement recorded', 'No external backup service is connected'],
      nist: 'RC.RP-01', origin: 'sample',
    },
  ];

  type LogInput = Omit<LogEvent, 'id' | 'timestamp' | 'origin'> & { minutesAgo: number };
  const logInputs: LogInput[] = [
    { minutesAgo: 1, severity: 'info', sourceIp: '10.24.4.7', destinationIp: '10.24.0.53', event: 'dns_query', message: 'Sample DNS query resolved by internal resolver.', assetId: 'ast-07', protocol: 'UDP', port: 53 },
    { minutesAgo: 2, severity: 'info', sourceIp: '10.24.1.10', destinationIp: '10.24.2.20', event: 'connection_allowed', message: 'Sample application-to-database session accepted.', assetId: 'ast-01', protocol: 'TCP', port: 5432 },
    { minutesAgo: 3, severity: 'critical', sourceIp: '10.24.4.14', destinationIp: '198.51.100.23', event: 'beacon_detected', message: 'Sample repeated outbound interval matched the beacon-pattern teaching rule.', assetId: 'ast-04', protocol: 'TCP', port: 443 },
    { minutesAgo: 4, severity: 'medium', sourceIp: '10.24.4.14', destinationIp: '198.51.100.23', event: 'outbound_connection', message: 'Sample outbound session to documentation-range destination.', assetId: 'ast-04', protocol: 'TCP', port: 443 },
    { minutesAgo: 5, severity: 'medium', sourceIp: '10.24.4.14', destinationIp: '198.51.100.23', event: 'outbound_connection', message: 'Sample outbound session repeated after one minute.', assetId: 'ast-04', protocol: 'TCP', port: 443 },
    { minutesAgo: 6, severity: 'high', sourceIp: '203.0.113.45', destinationIp: '10.24.0.1', event: 'vpn_suspicious', message: 'Sample VPN event explicitly flagged as an unusual session.', assetId: 'ast-05', protocol: 'TCP', port: 443, vpn: true },
    { minutesAgo: 7, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.3.10', event: 'failed_login', message: 'Sample account sign-in rejected: invalid credentials.', assetId: 'ast-03', protocol: 'TCP', port: 636 },
    { minutesAgo: 8, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.3.10', event: 'failed_login', message: 'Sample account sign-in rejected: invalid credentials.', assetId: 'ast-03', protocol: 'TCP', port: 636 },
    { minutesAgo: 9, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.3.10', event: 'failed_login', message: 'Sample account sign-in rejected: invalid credentials.', assetId: 'ast-03', protocol: 'TCP', port: 636 },
    { minutesAgo: 10, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.3.10', event: 'failed_login', message: 'Sample account sign-in rejected: invalid credentials.', assetId: 'ast-03', protocol: 'TCP', port: 636 },
    { minutesAgo: 11, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.3.10', event: 'failed_login', message: 'Sample account sign-in rejected: invalid credentials.', assetId: 'ast-03', protocol: 'TCP', port: 636 },
    { minutesAgo: 12, severity: 'high', sourceIp: '10.24.4.14', destinationIp: '10.24.3.10', event: 'privilege_change', message: 'Sample administrative role assignment outside the modeled change window.', assetId: 'ast-03', protocol: 'TCP', port: 636 },
    { minutesAgo: 12, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.3.10', event: 'failed_login', message: 'Sample account sign-in rejected: invalid credentials.', assetId: 'ast-03', protocol: 'TCP', port: 636 },
    { minutesAgo: 13, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.0.1', event: 'failed_login', message: 'Sample VPN sign-in rejected.', assetId: 'ast-05', protocol: 'TCP', port: 443, vpn: true },
    { minutesAgo: 14, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.0.1', event: 'failed_login', message: 'Sample VPN sign-in rejected.', assetId: 'ast-05', protocol: 'TCP', port: 443, vpn: true },
    { minutesAgo: 15, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.0.1', event: 'failed_login', message: 'Sample VPN sign-in rejected.', assetId: 'ast-05', protocol: 'TCP', port: 443, vpn: true },
    { minutesAgo: 16, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.0.1', event: 'failed_login', message: 'Sample VPN sign-in rejected.', assetId: 'ast-05', protocol: 'TCP', port: 443, vpn: true },
    { minutesAgo: 17, severity: 'medium', sourceIp: '203.0.113.45', destinationIp: '10.24.0.1', event: 'failed_login', message: 'Sample VPN sign-in rejected.', assetId: 'ast-05', protocol: 'TCP', port: 443, vpn: true },
    { minutesAgo: 90, severity: 'info', sourceIp: '10.24.4.7', destinationIp: '10.24.1.10', event: 'connection_allowed', message: 'Sample internal HTTPS request completed.', assetId: 'ast-07', protocol: 'TCP', port: 443 },
    { minutesAgo: 180, severity: 'medium', sourceIp: '198.51.100.88', destinationIp: '10.24.1.10', event: 'firewall_denied', message: 'Sample policy denied an inbound SSH attempt.', assetId: 'ast-01', protocol: 'TCP', port: 22 },
    { minutesAgo: 300, severity: 'medium', sourceIp: '198.51.100.88', destinationIp: '10.24.1.10', event: 'firewall_denied', message: 'Sample policy denied another inbound SSH attempt.', assetId: 'ast-01', protocol: 'TCP', port: 22 },
    { minutesAgo: 420, severity: 'info', sourceIp: '10.24.4.7', destinationIp: '10.24.0.53', event: 'dns_query', message: 'Sample workstation used the internal DNS resolver.', assetId: 'ast-08', protocol: 'UDP', port: 53 },
    { minutesAgo: 540, severity: 'medium', sourceIp: '203.0.113.74', destinationIp: '10.24.4.14', event: 'phishing_reported', message: 'Sample user report: unexpected account verification email.', assetId: 'ast-04' },
    { minutesAgo: 660, severity: 'info', sourceIp: '10.24.3.10', destinationIp: '10.24.4.7', event: 'login_success', message: 'Sample normal identity sign-in accepted.', assetId: 'ast-07', protocol: 'TCP', port: 88 },
    { minutesAgo: 780, severity: 'low', sourceIp: '10.24.4.14', destinationIp: '10.24.0.53', event: 'dns_query', message: 'Sample unusual hostname query marked for analyst review.', assetId: 'ast-04', protocol: 'UDP', port: 53 },
    { minutesAgo: 900, severity: 'info', sourceIp: '10.24.2.20', destinationIp: '10.24.2.30', event: 'backup_started', message: 'Sample scheduled database backup started.', assetId: 'ast-02', protocol: 'TCP', port: 445 },
    { minutesAgo: 1020, severity: 'info', sourceIp: '10.24.4.7', destinationIp: '10.24.0.1', event: 'vpn_connected', message: 'Sample approved remote access session established.', assetId: 'ast-05', protocol: 'TCP', port: 443, vpn: true },
    { minutesAgo: 1140, severity: 'info', sourceIp: '10.24.1.10', destinationIp: '10.24.0.53', event: 'dns_query', message: 'Sample web server DNS query completed.', assetId: 'ast-01', protocol: 'UDP', port: 53 },
    { minutesAgo: 1260, severity: 'info', sourceIp: '10.24.2.30', destinationIp: '10.24.2.20', event: 'backup_verified', message: 'Sample backup verification notification acknowledged; no real restore was performed.', assetId: 'ast-06', protocol: 'TCP', port: 445 },
    { minutesAgo: 1380, severity: 'info', sourceIp: '10.24.0.53', destinationIp: '10.24.0.1', event: 'heartbeat', message: 'Sample infrastructure heartbeat recorded.', assetId: 'ast-08' },
  ];
  const logs: LogEvent[] = logInputs.map(({ minutesAgo, ...entry }, index) => ({
    id: `log-${String(index + 1).padStart(2, '0')}`, timestamp: at(minutesAgo), ...entry, origin: 'sample',
  }));

  const nistControls: NistControl[] = [
    { id: 'GV.OC-01', function: 'Govern', category: 'Organizational Context', title: 'Understand the mission and risk context', description: 'Record business priorities and the stakeholders whose needs inform cybersecurity decisions.', done: false },
    { id: 'GV.RR-02', function: 'Govern', category: 'Roles, Responsibilities, and Authorities', title: 'Assign clear security responsibilities', description: 'Document accountable owners, response roles, and the authority to approve risk decisions.', done: false },
    { id: 'ID.AM-01', function: 'Identify', category: 'Asset Management', title: 'Maintain a hardware inventory', description: 'Review an authorized inventory of hardware and keep ownership and scope current.', done: false },
    { id: 'ID.RA-01', function: 'Identify', category: 'Risk Assessment', title: 'Identify and record vulnerabilities', description: 'Validate vulnerability findings through approved methods and record ownership and remediation priorities.', done: false },
    { id: 'PR.AA-01', function: 'Protect', category: 'Identity Management, Authentication, and Access Control', title: 'Manage identities and credentials', description: 'Review account lifecycle, authentication requirements, and access granted to users and services.', done: false },
    { id: 'PR.DS-01', function: 'Protect', category: 'Data Security', title: 'Protect data at rest', description: 'Document measures that protect the confidentiality, integrity, and availability of stored data.', done: false },
    { id: 'DE.CM-01', function: 'Detect', category: 'Continuous Monitoring', title: 'Monitor networks and services', description: 'Confirm what authorized network telemetry is collected and how potentially adverse events are reviewed.', done: false },
    { id: 'DE.AE-02', function: 'Detect', category: 'Adverse Event Analysis', title: 'Analyze potentially adverse events', description: 'Correlate relevant observations, record supporting evidence, and distinguish suspicion from confirmed impact.', done: false },
    { id: 'RS.MA-01', function: 'Respond', category: 'Incident Management', title: 'Execute an incident response plan', description: 'Define when the response plan starts and coordinate with affected parties through approved channels.', done: false },
    { id: 'RS.MI-01', function: 'Respond', category: 'Incident Mitigation', title: 'Plan proportionate containment', description: 'Record authorized containment actions, business impact, evidence preservation, and follow-up checks.', done: false },
    { id: 'RC.RP-01', function: 'Recover', category: 'Incident Recovery Plan Execution', title: 'Execute the recovery plan', description: 'Define approved recovery tasks and how their execution follows the incident response process.', done: false },
    { id: 'RC.CO-03', function: 'Recover', category: 'Incident Recovery Communication', title: 'Communicate recovery progress', description: 'Identify designated internal and external stakeholders and communicate recovery progress appropriately.', done: false },
  ];

  return {
    version: 1, mode: 'simulation', updatedAt: at(0), assets, alerts, logs,
    rules: [
      { id: 'rule-01', name: 'Block sample untrusted range', direction: 'inbound', action: 'deny', source: '203.0.113.0/24', destination: '10.24.0.0/16', protocol: 'ANY', port: null, enabled: true, createdAt: at(120) },
      { id: 'rule-02', name: 'Allow internal HTTPS', direction: 'inbound', action: 'allow', source: '10.24.0.0/16', destination: '10.24.0.0/16', protocol: 'TCP', port: 443, enabled: true, createdAt: at(119) },
      { id: 'rule-03', name: 'Allow internal DNS resolver', direction: 'outbound', action: 'allow', source: '10.24.0.0/16', destination: '10.24.0.53', protocol: 'UDP', port: 53, enabled: true, createdAt: at(118) },
      { id: 'rule-04', name: 'Deny unmanaged SSH ingress', direction: 'inbound', action: 'deny', source: '0.0.0.0/0', destination: '10.24.0.0/16', protocol: 'TCP', port: 22, enabled: true, createdAt: at(117) },
    ],
    actions: [{ id: 'act-seed', timestamp: at(0), actor: 'AEGIS', action: 'Workspace initialized', target: 'Local workspace', reason: 'Load the clearly labeled sample scenario.', result: 'Sample telemetry loaded; no external infrastructure was contacted.', mode: 'simulation' }],
    scans: [], quizResults: [], nistControls, watchlist: ['203.0.113.45', '198.51.100.23'],
    lab: {
      stage: 0,
      steps: [
        { id: 'lab-recon', title: 'Reconnaissance', description: 'Review the fixed local lab scope and model service discovery without probing another system.', mitre: 'T1046', completed: false },
        { id: 'lab-exploit', title: 'Initial access model', description: 'Walk through a synthetic vulnerable-service scenario. No exploit, payload, or shell is executed.', mitre: 'T1190', completed: false },
        { id: 'lab-privilege', title: 'Privilege escalation model', description: 'Examine a modeled excessive-permission finding and the least-privilege controls that would reduce risk.', mitre: 'T1068', completed: false },
        { id: 'lab-c2', title: 'Command-and-control detection', description: 'Correlate synthetic repeated outbound events with a beacon-pattern detection. No external connection is made.', mitre: 'T1071.001', completed: false },
        { id: 'lab-contain', title: 'Containment exercise', description: 'Record simulated containment and evidence-preservation decisions without changing a real device or firewall.', mitre: 'Response exercise', completed: false },
        { id: 'lab-report', title: 'Reporting and recovery', description: 'Summarize the modeled timeline and map next steps to NIST CSF 2.0 response and recovery outcomes.', mitre: 'Recovery exercise', completed: false },
      ],
    },
  };
}
