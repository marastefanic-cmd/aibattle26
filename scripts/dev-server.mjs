// Development supervisor for the API server.
//
// Runs `server/index.ts` through tsx and restarts it when server code changes, but
// only *between* AI turns: a restart in the middle of a turn would kill the AI
// subprocess and lose the user's reply. On change we ask the server to exit as soon
// as it is idle; it exits, and we start it again.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT ?? '3210';
const WATCH_DIRS = ['server', 'shared'].map((d) => path.join(root, d));

let child = null;
let restartRequested = false;
let debounce = null;

function start() {
  child = spawn(process.execPath, ['--import', 'tsx', path.join(root, 'server', 'index.ts')], {
    cwd: root, stdio: 'inherit', env: process.env,
  });
  child.on('exit', (code, signal) => {
    child = null;
    if (signal === 'SIGINT' || signal === 'SIGTERM') return;
    if (restartRequested || code !== 0) {
      restartRequested = false;
      console.log(`[dev] server ${code === 0 ? 'restarting' : `exited with ${code ?? signal}; restarting in 1s`}`);
      setTimeout(start, code === 0 ? 100 : 1000);
    }
  });
}

async function requestRestart() {
  restartRequested = true;
  try {
    const res = await fetch(`http://localhost:${port}/api/_restart`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (body.deferred) console.log('[dev] server code changed — will restart when the current AI turn finishes');
  } catch {
    // Server not up (crashed or still starting): kill and respawn.
    if (child) child.kill();
    else start();
  }
}

for (const dir of WATCH_DIRS) {
  watch(dir, { recursive: true }, (_event, file) => {
    if (!file || !/\.(ts|js|mjs|json)$/.test(file)) return;
    clearTimeout(debounce);
    debounce = setTimeout(requestRestart, 300);
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (child) child.kill(sig); process.exit(0); });
}

start();
