# AEGIS — Cybersecurity Operations Console

**Made by Vaibhav Thakur.** A local cybersecurity operations lab with an original cyber-themed wallpaper, a dark responsive command center, evidence-driven workflows, and a selected NIST CSF 2.0 mapping. It combines a labelled sample scenario, user-imported event logs, and a narrowly scoped TCP training service.

AEGIS is a development and training application. It does not silently connect to external targets, operate a real firewall, isolate remote endpoints, or execute exploit payloads. The interface distinguishes **sample**, **imported**, and **local-lab** evidence from **simulated** controls.

## What works

| Area | Capability |
| --- | --- |
| Overview | Current asset, alert, event, and response data summarized from the local API. |
| Threat intelligence | Filter and investigate recorded alerts, inspect supporting evidence, and correlate locally recorded IP and VPN observations. |
| Asset inventory | Inspect asset records and services; practice investigate, isolate, and release actions with a recorded reason. These update the model only. |
| Network analysis | Explore recorded traffic and VPN-related event context. Observations are limited to available data. |
| Event logs | Search and filter events, import validated JSON/JSONL records, and create rule-based investigation leads. |
| Reconnaissance | Make real TCP connection attempts to **127.0.0.1, ports 9091–9093** only. Results and timings are saved. |
| Attack lab | Advance a sequential MITRE ATT&CK-themed training storyline. Steps create labelled synthetic evidence, not exploits or command channels. |
| Incident response | Record simulated containment decisions, maintain an ordered firewall policy model, and evaluate example traffic against it. |
| Reports | Export the current evidence and response context as Markdown, JSON, or CSV. |
| NIST readiness | Review 12 selected controls across Govern, Identify, Protect, Detect, Respond, and Recover. Progress is self-attested, not a compliance score. |
| Knowledge check | Answer five questions, receive a score and explanations from the local API, retry, and retain attempt history and your best score. |

## Setup and development

Use **Node.js 22.12 or newer** and npm; `.nvmrc` selects Node.js **24**. No API keys, external account, database server, or additional credentials are required.

From the repository root:

```sh
npm ci
npm run dev
```

The development command starts both processes and stops the companion if either exits:

- **API:** Express with `tsx watch`, bound to loopback port **3001** by default.
- **Web:** Vite on port **5173**, listening on all interfaces for cloud development. Its `/api` proxy targets the loopback API.
- **Training listener:** a small HTTP service on loopback port **9091**. Ports **9092** and **9093** are control ports expected to be closed unless another local process occupies them.

Use the web address printed by Vite. Ports 3001, 5173, and 9091 must be free before startup. A TCP result reports what was observed at the time of the check; an open port does not establish that a service is vulnerable.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API, web development server, and local training listener. |
| `npm run dev:api` | Start only the API and training listener. |
| `npm run dev:web` | Start only Vite; an API must already be available. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run unit/API tests in watch mode. |
| `npm run build` | Type-check the application and produce the web build in `dist/`. |
| `npm start` | Start the production API and serve the built frontend; build first. |
| `npm run test:browser` | Run isolated Playwright browser checks. |
| `npm run smoke` | Check the running frontend, API, state, and report without changing data. |

For this cloud workspace, an optional local npm cache keeps installation writes inside the workspace:

```sh
npm ci --cache /workspace/.cache/npm
```

The health endpoint `/api/health` reports the API mode and configured lab listener. Application state is available from `/api/state`; `/api/events` sends state-change notifications. A healthy process alone does not validate a complete workflow—also exercise a log import, local check, response action, or knowledge check.

### Production run

```sh
npm run build
npm start
```

The production server serves both `dist/` and `/api` from port **3001** by default. This application requires the Node API; uploading `dist/` alone does not provide persistence, log analysis, local TCP checks, reports, or quiz scoring.

The API defaults to `HOST=127.0.0.1`, `PORT=3001`, and `AEGIS_DATA_DIR=.data`. Run commands from the repository root so the build and data paths resolve as expected. Keep the default lab port configuration for the documented frontend workflow. If changing the API port during development, update Vite’s proxy to match.

AEGIS is intended for a single operator in a trusted local or private environment. It has no multi-user authentication or permission separation. A shared deployment needs its own access control and appropriate HTTPS termination; those are not included in this lab.

## Importing real event logs

Use a JSON array or JSONL with one complete object per line. Imports accept **1–1,000 records** and up to **2 MiB of log text**. Records are validated before the import is saved; malformed records identify their position in the error response.

Required fields are `timestamp`, `severity`, `sourceIp`, `destinationIp`, `event`, and `message`. Optional fields are `assetId`, `protocol`, `port`, and `vpn`. Addresses must be IPv4; timestamps must use ISO-8601 with a timezone. `assetId`, when supplied, must refer to an existing workspace asset. Severity is `critical`, `high`, `medium`, `low`, or `info`.

```json
[
  {
    "timestamp": "2026-10-21T10:00:00Z",
    "severity": "high",
    "sourceIp": "198.51.100.42",
    "destinationIp": "10.24.2.18",
    "event": "failed_login",
    "message": "Rejected sign-in attempt reported by the source system",
    "protocol": "TCP",
    "port": 443,
    "vpn": false
  }
]
```

Local detection rules look for five authentication failures from an IP within ten minutes, explicitly flagged VPN events, watchlist source-IP matches, and endpoint events labelled `malware_detected` or `suspicious_process`. A rule match is an investigation lead, not proof of compromise. A single record such as the example above does not by itself satisfy the authentication-burst threshold.

The console cannot identify someone behind a VPN. VPN labels and anomaly wording come from supplied event metadata, not external attribution or a deanonymization service. Adding an IP to the local watchlist does not perform a reputation lookup or make that address malicious.

## Persistence, provenance, and reset

State is saved by the local API to **`.data/state.json`**, including imported log messages, alerts, asset states, policy rules, response actions, scans, readiness marks, and quiz results. It persists across server restarts and is shared by browsers using the same running instance. No cloud synchronization or user account is involved. The `.data/` directory is ignored by Git.

The store uses atomic replacement when saving. If saved state is corrupt or unsupported, startup fails with an explanation instead of silently replacing it. Preserve the file before restoring a known-good copy. For a manual backup, stop the server and copy `.data/` to a protected location appropriate for the sensitivity of any imported logs.

Resetting the training sequence removes its synthetic lab alerts and logs and returns the scenario to its first step. It retains manual asset state, scans, operator actions, imported logs, and sample evidence. A full demo reset replaces the workspace with the sample scenario; export reports or back up state first if the current evidence is needed.

Reports are downloads, not a workspace restore format. JSON/CSV/Markdown report import is not implemented. The event-log importer accepts only its documented schema.

## Framework and operational scope

See [the NIST CSF 2.0 mapping](docs/nist-mapping.md) for the selected references, evidence sources, and limitations. Review marks are manual declarations. AEGIS does not implement every CSF outcome or issue a certification.

- The reconnaissance endpoint rejects external hosts and ports outside the configured three-port loopback scope.
- Firewall evaluation uses the first enabled matching rule and a simulated default deny. It does not apply OS firewall rules. The evaluator matches traffic direction (inbound or outbound), source, destination, protocol, and destination port.
- Investigate/isolate/release actions change only local model state. A real containment action requires authorized endpoint or network infrastructure controls.
- The attack storyline emits synthetic records only. No exploitation, privilege escalation, external command-and-control, packet capture, credential harvesting, or remote shell is implemented.
- Imported logs are analyzed locally, but their authenticity and completeness are not independently verified. Retain source-system evidence for real investigations.

## Architecture

```text
src/                   React + TypeScript console and responsive CSS
  components/          Dashboard, operations, governance, quiz, and dialogs
  lib/api.ts           Same-origin API helper and download utility
shared/
  types.ts             API and domain types
  seed.ts              Labelled sample scenario and readiness controls
  analysis.ts          Shared aggregation and presentation analysis
  quiz.ts              Five-question educational content
server/
  app.ts               Validated API, state events, local TCP checks, and lab actions
  index.ts             Process startup and shutdown
  store.ts             Versioned local persistence
  imports.ts           Log validation and detection rules
  firewall.ts          Ordered policy simulation
  reports.ts           Report generation
docs/nist-mapping.md   Framework references and evidence scope
```

React and Lucide render the interface; Vite builds it. Express serves the API and production frontend. Fonts are bundled npm assets, and no external AI or reputation API is required. Dependencies are pinned in `package-lock.json`; use `npm ci` for repeatable installation.

## Validation

Run `npm test`, then `npm run build`, then `npm run test:browser`. The browser suite starts its own disposable workspace under `/tmp` and stops its services afterward; ports 3001, 5173, and 9091 must be free. Existing servers are not reused by default, so test resets cannot overwrite an operator’s imported data. `AEGIS_E2E_REUSE=1` explicitly opts into reuse and resets that instance; use it only for a disposable test server. Browser tests require Chromium; the prepared cloud environment provides `/usr/bin/chromium`. A custom executable can be selected with `CHROMIUM_PATH`. See `playwright.config.ts` for details.

Once the app is running, `npm run smoke` makes read-only checks against the development server. For a production server, use `AEGIS_BASE_URL=http://127.0.0.1:3001 npm run smoke`. This check does not modify logs, control marks, or quiz history.

Made by **Vaibhav Thakur**.
