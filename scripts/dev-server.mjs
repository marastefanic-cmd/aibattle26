// Development supervisor: runs the terminal host and the API server.
//
// - The terminal host (server/terminal-host.ts) owns the assistant terminals. It is
//   started once and only restarted if it crashes, so running assistants survive
//   everything else.
// - The API server (server/index.ts) restarts whenever code under server/ or shared/
//   changes — including changes the assistant makes to the app itself.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WATCH_DIRS = ['server', 'shared'].map((d) => path.join(root, d));
const HOST_FILE = 'terminal-host.ts';

function run(label, entry, { restartOnChange }) {
  let child = null;
  let restarting = false;
  const start = () => {
    child = spawn(process.execPath, ['--import', 'tsx', path.join(root, 'server', entry)], { cwd: root, stdio: 'inherit', env: process.env });
    child.on('exit', (code, signal) => {
      child = null;
      if (signal === 'SIGINT' || signal === 'SIGTERM') return;
      if (restarting) { restarting = false; start(); return; }
      console.log(`[dev] ${label} exited (${code ?? signal}); restarting in 1s`);
      setTimeout(start, 1000);
    });
  };
  start();
  return {
    restart: () => { if (!restartOnChange) return; if (child) { restarting = true; child.kill(); } else start(); },
    kill: (sig) => child?.kill(sig),
  };
}

const host = run('terminal host', HOST_FILE, { restartOnChange: false });
const apiServer = run('API server', 'index.ts', { restartOnChange: true });

let debounce = null;
for (const dir of WATCH_DIRS) {
  watch(dir, { recursive: true }, (_event, file) => {
    if (!file || !/\.(ts|js|mjs|json)$/.test(file)) return;
    if (path.basename(file) === HOST_FILE) {
      console.log('[dev] terminal-host.ts changed — restart the app (close its window and start it again) to apply');
      return;
    }
    clearTimeout(debounce);
    debounce = setTimeout(() => { console.log('[dev] server code changed — restarting API server'); apiServer.restart(); }, 300);
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { apiServer.kill(sig); host.kill(sig); process.exit(0); });
}
