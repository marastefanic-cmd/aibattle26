// Rulebook Studio launcher: behaves like a desktop app while everything runs locally.
//
//   node scripts/launch.mjs
//
// 1. If the app is already running, just open its window.
// 2. Otherwise: update from GitHub (git clones only), install dependencies if needed,
//    start the servers hidden in the background (log in .run/app.log), wait until they
//    answer, then open the app in a Chrome/Edge "app window" (no address bar, own icon).
//    Falls back to the default browser.
// The app keeps running when the window is closed; the Quit button in the app stops it.
import { execFileSync, execSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_DIR = path.join(root, '.run');
const PIDS_FILE = path.join(RUN_DIR, 'pids.json');
const LOG_FILE = path.join(RUN_DIR, 'app.log');
const API = `http://localhost:${process.env.PORT ?? 3210}`;
const UI = `http://localhost:${process.env.UI_PORT ?? 5173}`;
const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';

const log = (msg) => console.log(`[launch] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function healthy(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}

// ---------- update (git clones only) ----------
function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts }).trim();
}

function update() {
  if (process.env.SKIP_UPDATE) return false;
  try { git(['rev-parse', '--git-dir']); } catch { return false; } // ZIP install: nothing to do
  log('Checking for updates…');
  const before = git(['rev-parse', 'HEAD']);
  let stashed = false;
  if (git(['status', '--porcelain'])) {
    try { git(['stash', 'push', '--include-untracked', '--quiet', '-m', `local changes before update ${new Date().toISOString()}`]); stashed = true; } catch { /* nothing to stash */ }
  }
  try { git(['pull', '--ff-only', '--quiet']); }
  catch { log('Could not fetch updates (offline, or the repository has diverged). Continuing with the current version.'); }
  if (stashed) {
    try { git(['stash', 'pop', '--quiet']); }
    catch {
      try { git(['checkout', '--', '.']); git(['reset', '--hard', 'HEAD', '--quiet']); } catch { /* best effort */ }
      log('Local changes to the app conflicted with the update. They are kept in "git stash list"; ask the assistant in "The app" to re-apply them.');
    }
  }
  const changed = before !== git(['rev-parse', 'HEAD']);
  if (changed) log('Updated to the latest version.');
  return changed;
}

// ---------- dependencies ----------
function install() {
  log('Installing the app\'s components (this takes a minute)…');
  if (WIN) {
    // Show progress in its own console window, wait for it to finish.
    spawnSync('cmd.exe', ['/d', '/s', '/c', `start "Rulebook Studio — installing" /wait cmd /c "npm install --no-audit --no-fund || pause"`], { cwd: root, stdio: 'ignore' });
  } else {
    spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
  }
  if (!fs.existsSync(path.join(root, 'node_modules', 'vite'))) throw new Error('Installation failed. Run "npm install" in the app folder to see why.');
}

// ---------- servers ----------
function startServers() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const out = fs.openSync(LOG_FILE, 'a');
  const common = { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', out, out], env: { ...process.env, BROWSER: 'none' } };
  const supervisor = spawn(process.execPath, [path.join(root, 'scripts', 'dev-server.mjs')], common);
  const vite = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')], common);
  supervisor.unref(); vite.unref();
  fs.writeFileSync(PIDS_FILE, JSON.stringify({ supervisor: supervisor.pid, vite: vite.pid, started: new Date().toISOString() }));
}

async function waitForServers() {
  for (let i = 0; i < 90; i++) {
    if (await healthy(`${API}/api/health`) && await healthy(UI)) return true;
    await sleep(1000);
  }
  return false;
}

// ---------- window ----------
function findBrowser() {
  const env = process.env;
  const candidates = WIN ? [
    path.join(env['ProgramFiles'] ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env['LocalAppData'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env['ProgramFiles'] ?? 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env['ProgramFiles'] ?? 'C:\\Program Files', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  ] : MAC ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'];
  for (const c of candidates) {
    if (WIN || MAC) { if (fs.existsSync(c)) return c; }
    else { try { execSync(`command -v ${c}`, { stdio: 'ignore' }); return c; } catch { /* next */ } }
  }
  return null;
}

function openWindow() {
  const browser = findBrowser();
  if (browser) {
    const profile = path.join(RUN_DIR, 'browser-profile');
    const child = spawn(browser, [`--app=${UI}`, `--user-data-dir=${profile}`, '--window-size=1400,900', '--no-first-run', '--no-default-browser-check'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return;
  }
  // No Chromium-based browser: default browser as a normal tab.
  const cmd = WIN ? ['cmd.exe', ['/c', 'start', '', UI]] : MAC ? ['open', [UI]] : ['xdg-open', [UI]];
  try { spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref(); } catch { log(`Open ${UI} in your browser.`); }
}

// ---------- desktop shortcut (Windows, once) ----------
function createShortcutOnce() {
  if (!WIN) return;
  const marker = path.join(RUN_DIR, 'shortcut-created');
  if (fs.existsSync(marker)) return;
  const vbs = path.join(root, 'Rulebook Studio.vbs');
  const icon = path.join(root, 'assets', 'icon.ico');
  const ps = `$s=(New-Object -COM WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\\Rulebook Studio.lnk');` +
    `$s.TargetPath='wscript.exe';$s.Arguments='"${vbs}"';$s.WorkingDirectory='${root}';$s.IconLocation='${icon}';$s.Description='Rulebook Studio';$s.Save()`;
  try {
    spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore', windowsHide: true });
    fs.mkdirSync(RUN_DIR, { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString());
    log('A "Rulebook Studio" shortcut was placed on the desktop.');
  } catch { /* cosmetic */ }
}

// ---------- main ----------
try {
  if (await healthy(`${API}/api/health`)) {
    log('Already running — opening the window.');
    openWindow();
    process.exit(0);
  }
  const updated = update();
  if (updated || !fs.existsSync(path.join(root, 'node_modules', 'vite'))) install();
  log('Starting…');
  startServers();
  if (!(await waitForServers())) throw new Error(`The app did not start. See ${LOG_FILE}`);
  createShortcutOnce();
  openWindow();
  log(`Running. Window: ${UI}. Closing the window keeps the app running; use Quit in the app to stop it.`);
  process.exit(0);
} catch (err) {
  console.error(`[launch] ${err instanceof Error ? err.message : err}`);
  if (WIN) spawnSync('cmd.exe', ['/c', 'pause'], { stdio: 'inherit' });
  process.exit(1);
}
