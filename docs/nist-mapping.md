# AEGIS and NIST CSF 2.0

AEGIS uses the six functions of the [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) to organize a small, self-attested readiness review. The mapping below is an aid to learning and organizing evidence. It is not an implementation of the entire CSF, an audit, or a certification.

The framework describes outcomes, rather than prescribing one product or checklist. AEGIS exposes selected outcome references and lets a user record that they reviewed a control. A saved tick does not establish that an organization achieved the outcome.

## Selected outcome references

| Function | Reference | Review focus | Relevant AEGIS artifacts and limits |
| --- | --- | --- | --- |
| Govern | **GV.OC-01** · Organizational Context | Understand organizational mission and how it informs cybersecurity risk management. | Workspace scope and asset context can support discussion. Actual mission, business requirements, and risk decisions must be documented outside the demo. |
| Govern | **GV.RR-02** · Roles, Responsibilities, and Authorities | Establish and communicate cybersecurity roles, responsibilities, and authorities. | Asset owner fields and the response action ledger provide local context. They do not establish organization-wide accountability or enforce roles. |
| Identify | **ID.AM-01** · Asset Management | Maintain inventories of organizational hardware. | The asset register records the workspace’s assets and services. Sample assets are not discovered infrastructure; the app does not automatically inventory a real organization. |
| Identify | **ID.RA-01** · Risk Assessment | Identify, validate, and record asset vulnerabilities. | Alert evidence and local-lab findings are investigation inputs. Rule matches need validation and do not constitute a vulnerability assessment of a remote system. |
| Protect | **PR.AA-01** · Identity Management, Authentication, and Access Control | Manage identities and credentials for authorized users, services, and hardware. | Inventory and simulated policy context can support review. AEGIS is not an identity provider and does not provision accounts, enforce MFA, or manage remote credentials. |
| Protect | **PR.DS-01** · Data Security | Protect the confidentiality, integrity, and availability of data at rest. | Review local data handling and report storage. The app does not establish enterprise encryption, backups, retention controls, or data-loss prevention. |
| Detect | **DE.CM-01** · Continuous Monitoring | Monitor networks and network services for potentially adverse events. | Sample events, user-imported logs, and fixed loopback TCP checks offer bounded visibility. They are not continuous monitoring of a production network. |
| Detect | **DE.AE-02** · Adverse Event Analysis | Analyze potentially adverse events to understand their associated activities. | Rule-based alerts link to available evidence. Analysts must validate findings and consider source quality, missing context, and false positives. |
| Respond | **RS.MA-01** · Incident Management | Execute the incident response plan in coordination with relevant parties after an incident is declared. | Alert workflow and the local action ledger can document practice decisions. They do not contact third parties or execute an organization’s response plan. |
| Respond | **RS.MI-01** · Incident Mitigation | Contain incidents. | Containment and isolation actions update simulated state and the ledger. They do not modify operating-system firewalls or isolate remote endpoints. |
| Recover | **RC.RP-01** · Incident Recovery Plan Execution | Execute the recovery portion of the incident response plan when initiated. | Reports and action history can support a recovery handoff. Actual system restoration, backup validation, and recovery testing occur outside AEGIS. |
| Recover | **RC.CO-03** · Incident Recovery Communication | Communicate recovery progress to designated stakeholders. | Exported case reports can be reviewed and shared through approved channels. AEGIS does not send stakeholder communications or verify their receipt. |

Reference descriptions are concise paraphrases for this application. Consult the official CSF 2.0 publication and your organization’s chosen profile for the full outcomes, scope, and evidence requirements.

## Evidence and provenance

- **Sample data** is seeded training context. Its presence is not evidence of an incident on a real device.
- **Imported logs** are real user-provided input. Findings are produced by bounded local detection rules; importing or matching an event does not verify the source, infer missing events, or prove compromise.
- **Local-lab results** come from fixed loopback TCP services on ports 9091–9093. They describe that controlled environment only.
- **Simulated policies and response actions** are saved workspace records. They do not apply host firewall changes, exploit payloads, remote isolation, or enforcement to another machine.
- **NIST review marks** are manual declarations, persisted by the local API. Progress is the number of reviewed controls divided by the number of controls, not a measured security or compliance score.

VPN-related observations are limited to supplied event metadata and rules. AEGIS cannot reveal an identity behind a VPN or prove that traffic is malicious simply because it uses a VPN.

Before treating an artifact as organizational evidence, verify its origin, freshness, scope, and integrity. Record missing evidence and obtain review from the responsible people. Use approved storage and sharing practices for reports that contain real log data.

Made by **Vaibhav Thakur**.
