# Cipher

A local-first cybersecurity workspace for building everyday security habits. Learn practical skills, try browser-based tools, and track a personal readiness checklist. No account, backend, database, or API keys are required.

## What you can do

- **See your progress:** a dashboard shows completed modules, checklist progress, best quiz score, and recent activity. These reflect your actions, not a device security scan.
- **Learn the essentials:** six modules cover passwords, phishing, networks, device security, web privacy, and incident response. Each contains three lessons and a three-question quiz, for 18 lessons and 18 questions in total. Answer at least two questions correctly to complete a module; your best result is retained.
- **Use four local tools:** check password strength, generate random passwords with selected character types, calculate SHA-256 text hashes, and inspect URL structure for warning signs.
- **Build useful habits:** mark ten practical tasks across Accounts, Devices, Network, and Recovery. Filter the list and revisit it as your setup changes.
- **Find and manage your work:** search modules and tools, export progress as JSON, or reset saved progress after confirmation. Press `/` to open workspace search.

## Run locally

Install Node.js **22.12 or newer** and npm. The cloud environment uses Node.js 24.

```sh
npm ci
npm run dev
```

Run these commands from the repository root. Vite prints the local development address in the terminal. The development server listens on all interfaces, which allows a cloud runtime to reach it; use a trusted development environment.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot reload. |
| `npm start` | Alias for the development server. |
| `npm test` | Run the unit test suite once. |
| `npm run test:watch` | Run unit tests in watch mode. |
| `npm run build` | Type-check the source and create the production `dist/` directory. |
| `npm run preview` | Serve the production build for local verification; run the build first. |
| `npm run test:browser` | Run Playwright browser checks. |

For cloud setup, an optional workspace-local npm cache keeps installation writes inside the workspace:

```sh
npm ci --cache /workspace/.cache/npm
```

### Browser tests

Browser checks require Chromium in addition to npm dependencies. The prepared cloud environment uses `/usr/bin/chromium`. `playwright.config.ts` also accepts a custom executable through `CHROMIUM_PATH`; if neither is present, it uses Playwright’s installed browser. On another machine, run `npx playwright install chromium` before `npm run test:browser`, or set `CHROMIUM_PATH` to your existing Chromium executable. The test runner starts and stops its own local development server when needed.

Unit tests exercise password and URL analysis, cryptographic output, password generation boundaries, and progress-data validation. Browser tests exercise the application’s actual user flows.

## Privacy and limits

Tool inputs are processed in the browser and are not sent to an API or written to saved progress. Generated passwords and tool inputs remain only in page memory; save a generated password in a password manager before leaving. Prefer an example password when exploring the strength checker.

Learning results, checklist choices, and generic activity messages are stored in this browser’s `localStorage` under `cipher-workspace-v1`. They do not synchronize between devices or browser profiles. Clearing site data removes them; if browser storage is blocked, progress lasts only for the current session. **Workspace settings → Export** downloads `cipher-progress.json` as a readable record. Importing that file is not currently supported. Reset clears the workspace’s saved progress after confirmation.

Password scores are teaching heuristics, not breach checks or guarantees of resistance to attack. The URL inspector evaluates supplied text without contacting the destination; it is not a malware or reputation scanner, and a low-risk result does not establish that a site is safe. SHA-256 is a fingerprinting tool, not encryption or a password-storage algorithm. The checklist is self-reported: Cipher does not inspect devices, account settings, or networks.

## Project structure

```text
src/
  App.tsx                    Dashboard, hash navigation, search, and workspace settings
  components/                Security tools, learning/quiz dialogs, and shared modal
  data/learning.ts           Six modules, quiz content, and checklist tasks
  lib/security.ts            Local password, URL, hashing, and generation utilities
  lib/progress.ts            Versioned progress parsing and bounded activity history
  lib/*.test.ts              Unit tests
  styles.css                 Responsive application layout and styles
```

The interface uses React, TypeScript, and Lucide icons, with Vite for development and production builds. Vitest runs unit tests and Playwright runs browser checks. Dependencies are pinned in `package-lock.json`; use `npm ci` for repeatable installation. Fonts are bundled locally, so the production interface does not need third-party asset requests. The included GitHub Actions workflow runs unit tests and a production build on pushes and pull requests.

## Deploy a production build

Run `npm run build` and serve the contents of `dist/` from a static host over **HTTPS**. Web Crypto and clipboard features require a secure browser context; local loopback development is also supported. Do not open `index.html` directly as a local file.

Navigation uses hash routes such as `#/overview`, `#/tools`, `#/learn`, and `#/checklist`, so it does not require server-side route rewriting. The default Vite configuration targets the host root; configure Vite’s `base` if deploying under a URL subdirectory. Hosting the static build does not require an application server, secrets, or a database.
