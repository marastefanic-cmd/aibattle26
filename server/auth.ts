import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { AuthStatus } from '../shared/types.js';
import { HttpError, LOCAL_DIR, claudeBinary } from './paths.js';

const CREDENTIALS_FILE = path.join(LOCAL_DIR, 'credentials.json');

interface LoginFlow {
  child: ChildProcess;
  output: string;
  url?: string;
  exited?: number | null;
}

/**
 * Connects the app to Claude in one of two ways and remembers it:
 * - Claude subscription: drives `claude auth login` (the CLI stores the login on this machine)
 * - API key: saved to workspace/.local/credentials.json and passed to the SDK as an env var
 */
class AuthManager {
  private apiKey: string | undefined;
  private flow: LoginFlow | undefined;

  constructor() {
    try {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8')) as { apiKey?: string };
      this.apiKey = data.apiKey || undefined;
    } catch { /* no saved credentials */ }
    if (!this.apiKey && process.env.ANTHROPIC_API_KEY) this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  /** Environment additions for the SDK subprocess. */
  sdkEnv(): Record<string, string> {
    return this.apiKey ? { ANTHROPIC_API_KEY: this.apiKey } : {};
  }

  saveApiKey(key: string): void {
    const trimmed = key.trim();
    if (!/^sk-ant-/.test(trimmed)) throw new HttpError(400, 'That does not look like an Anthropic API key (they start with "sk-ant-").');
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify({ apiKey: trimmed }), { mode: 0o600 });
    this.apiKey = trimmed;
  }

  private clearApiKey(): void {
    this.apiKey = undefined;
    try { fs.unlinkSync(CREDENTIALS_FILE); } catch { /* nothing saved */ }
  }

  async status(): Promise<AuthStatus> {
    if (this.apiKey) return { connected: true, method: 'api_key', detail: `API key ending in …${this.apiKey.slice(-4)}` };
    try {
      const out = await run(['auth', 'status', '--json'], 15_000);
      const parsed = JSON.parse(out.slice(out.indexOf('{'))) as { loggedIn?: boolean; authMethod?: string; email?: string; subscriptionType?: string };
      if (parsed.loggedIn) {
        const detail = [parsed.email, parsed.subscriptionType].filter(Boolean).join(' · ') || 'Claude account';
        return { connected: true, method: 'claude_login', detail };
      }
      return { connected: false, method: 'none' };
    } catch (err) {
      return { connected: false, method: 'none', detail: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Starts `claude auth login` and returns the sign-in URL it prints. */
  async startLogin(mode: 'claudeai' | 'console'): Promise<{ url: string }> {
    this.cancelLogin();
    const child = spawn(claudeBinary(), ['auth', 'login', mode === 'console' ? '--console' : '--claudeai'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: process.env.BROWSER ?? '' },
    });
    const flow: LoginFlow = { child, output: '' };
    this.flow = flow;
    const onData = (d: Buffer) => { flow.output += d.toString(); };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('exit', (code) => { flow.exited = code; });

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const m = flow.output.match(/https:\/\/\S+oauth\S+/);
      if (m) { flow.url = m[0]; return { url: m[0] }; }
      if (flow.exited !== undefined) break;
      await sleep(200);
    }
    this.cancelLogin();
    throw new HttpError(500, `Could not start the sign-in. Output: ${flow.output.trim().slice(-400) || '(none)'}`);
  }

  /** Pastes the code from the browser into the waiting login process. */
  async submitCode(code: string): Promise<AuthStatus> {
    const flow = this.flow;
    if (!flow || flow.exited !== undefined) throw new HttpError(409, 'The sign-in has expired. Start it again.');
    const before = flow.output.length;
    flow.child.stdin?.write(`${code.trim()}\n`);
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && flow.exited === undefined) await sleep(250);
    const tail = flow.output.slice(before).trim();
    this.flow = undefined;
    if (flow.exited === undefined) { flow.child.kill(); throw new HttpError(500, 'The sign-in did not finish. Try again.'); }
    const status = await this.status();
    if (!status.connected) throw new HttpError(400, `Sign-in failed: ${tail.slice(-300) || 'the code was not accepted'}`);
    return status;
  }

  cancelLogin(): void {
    if (this.flow && this.flow.exited === undefined) this.flow.child.kill();
    this.flow = undefined;
  }

  async logout(): Promise<void> {
    this.clearApiKey();
    try { await run(['auth', 'logout'], 15_000); } catch { /* not logged in */ }
  }
}

function run(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBinary(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { out += d.toString(); });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Claude did not answer in time')); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('exit', () => { clearTimeout(timer); resolve(out); });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const auth = new AuthManager();
