import { resolve } from 'node:path';
import { createApp } from './app.js';

const apiPort = Number(process.env.PORT ?? 3001);
const labPort = Number(process.env.LAB_PORT ?? 9091);
if (!Number.isInteger(apiPort) || apiPort < 1024 || apiPort > 65535) throw new Error('PORT must be an integer from 1024 to 65535.');
if (apiPort >= labPort && apiPort <= labPort + 2) throw new Error('PORT must differ from the three scoped lab ports.');
const host = process.env.HOST ?? '127.0.0.1';
const app = createApp({ dataDir: resolve(process.env.AEGIS_DATA_DIR ?? '.data'), labPort, startLab: true });
await app.locals.ready;
const server = app.listen(apiPort, host, () => {
  console.log(`AEGIS API listening on ${host}:${apiPort} (simulation mode).`);
  console.log(`Local training listener bound to 127.0.0.1:${labPort}; scoped scan ports ${labPort}, ${labPort + 1}, ${labPort + 2}.`);
});
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  await app.locals.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}
process.on('SIGTERM', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
