/**
 * Terminal host: a small standalone process that owns the assistant terminals.
 *
 * It is separate from the API server on purpose: the API server restarts whenever its
 * code changes (hot reload, including changes the assistant makes to the app itself),
 * and a running assistant must survive that. The API server asks this process to
 * spawn/kill terminals over HTTP; the browser attaches to them over WebSocket.
 */
import http from 'node:http';
import * as pty from 'node-pty';
import { WebSocketServer, type WebSocket } from 'ws';

const PORT = Number(process.env.TERMINAL_PORT ?? 3211);
const SCROLLBACK_LIMIT = 400_000; // characters kept for replay when a browser (re)attaches

interface Term {
  proc: pty.IPty;
  scrollback: string;
  alive: boolean;
  exitCode: number | null;
  sockets: Set<WebSocket>;
}

interface SpawnRequest {
  id: string;
  file: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  cols?: number;
  rows?: number;
}

const terms = new Map<string, Term>();

function readJson<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c: Buffer) => { body += c.toString(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}') as T); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function broadcast(term: Term, msg: unknown): void {
  const text = JSON.stringify(msg);
  for (const ws of term.sockets) if (ws.readyState === ws.OPEN) ws.send(text);
}

function spawnTerm(req: SpawnRequest): Term {
  const existing = terms.get(req.id);
  if (existing?.alive) return existing;
  const proc = pty.spawn(req.file, req.args, {
    name: 'xterm-256color',
    cols: req.cols ?? 120,
    rows: req.rows ?? 36,
    cwd: req.cwd,
    env: req.env,
  });
  const term: Term = { proc, scrollback: existing?.scrollback ?? '', alive: true, exitCode: null, sockets: existing?.sockets ?? new Set() };
  if (existing) term.scrollback += '\r\n\x1b[2m— restarted —\x1b[0m\r\n';
  terms.set(req.id, term);
  proc.onData((data) => {
    term.scrollback = (term.scrollback + data).slice(-SCROLLBACK_LIMIT);
    broadcast(term, { type: 'data', data });
  });
  proc.onExit(({ exitCode }) => {
    term.alive = false;
    term.exitCode = exitCode;
    broadcast(term, { type: 'exit', code: exitCode });
  });
  return term;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const [, action, id] = url.pathname.split('/');
    if (req.method === 'POST' && action === 'spawn') {
      const body = await readJson<SpawnRequest>(req);
      const term = spawnTerm(body);
      return send(res, 200, { alive: term.alive, pid: term.proc.pid });
    }
    if (req.method === 'GET' && action === 'status' && id) {
      const term = terms.get(id);
      return send(res, 200, { launched: Boolean(term), alive: term?.alive ?? false, exitCode: term?.exitCode ?? null });
    }
    if (req.method === 'POST' && action === 'kill' && id) {
      const term = terms.get(id);
      if (term?.alive) term.proc.kill();
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && action === 'list') {
      return send(res, 200, [...terms.entries()].map(([k, t]) => ({ id: k, alive: t.alive })));
    }
    if (req.method === 'GET' && action === 'health') return send(res, 200, { ok: true, terminals: terms.size });
    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const m = url.pathname.match(/^\/term\/([A-Za-z0-9-]+)$/);
  if (!m) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const term = terms.get(m[1]);
    if (!term) { ws.send(JSON.stringify({ type: 'missing' })); ws.close(); return; }
    term.sockets.add(ws);
    ws.send(JSON.stringify({ type: 'scrollback', data: term.scrollback, alive: term.alive, exitCode: term.exitCode }));
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; data?: string; cols?: number; rows?: number };
        if (!term.alive) return;
        if (msg.type === 'input' && typeof msg.data === 'string') term.proc.write(msg.data);
        else if (msg.type === 'resize' && msg.cols && msg.rows) term.proc.resize(Math.max(20, msg.cols), Math.max(5, msg.rows));
      } catch { /* ignore malformed frames */ }
    });
    ws.on('close', () => term.sockets.delete(ws));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[terminals] host on http://127.0.0.1:${PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    for (const t of terms.values()) if (t.alive) t.proc.kill();
    process.exit(0);
  });
}
