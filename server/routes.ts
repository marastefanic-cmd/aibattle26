import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import type { HealthInfo, Scope, SessionKind } from '../shared/types.js';
import { agentInfos, buildLaunch } from './agents.js';
import { buildContext } from './context.js';
import { spawn } from 'node:child_process';
import { APP_DIR, HttpError, RUN_DIR, WORKSPACE_DIR } from './paths.js';
import * as store from './store.js';
import { terminals } from './terminals.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
export const api = Router();

/** Express 5 types params as string | string[]; our routes only use simple segments. */
type Req = Request<Record<string, string>>;
type Handler = (req: Req, res: Response) => Promise<unknown> | unknown;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req as Req, res))
    .then((data) => { if (!res.headersSent) res.json(data ?? { ok: true }); })
    .catch(next);
};

function scopeOf(req: Req): { scope: Scope; projectId?: string } {
  const scope = req.params.scope as Scope;
  if (scope !== 'global' && scope !== 'project') throw new HttpError(400, 'scope must be global or project');
  const projectId = scope === 'project' ? String(req.query.project ?? req.body?.project ?? '') : undefined;
  if (scope === 'project' && !projectId) throw new HttpError(400, 'project query parameter required');
  return { scope, projectId };
}

// ---------- health & settings ----------
api.get('/health', wrap(async (): Promise<HealthInfo> => {
  const settings = await store.getSettings();
  return {
    ok: true,
    workspaceDir: WORKSPACE_DIR,
    appDir: APP_DIR,
    settings,
    agents: agentInfos(settings),
    terminalHost: await terminals.healthy(),
  };
}));
api.get('/settings', wrap(() => store.getSettings()));
api.put('/settings', wrap((req) => store.updateSettings(req.body ?? {})));

// ---------- files ----------
api.get('/files/:scope', wrap((req) => {
  const { scope, projectId } = scopeOf(req);
  return store.listFiles(scope, projectId);
}));

api.get('/files/:scope/content', wrap(async (req, res) => {
  const { scope, projectId } = scopeOf(req);
  const rel = String(req.query.path ?? '');
  const { abs, text } = await store.readFile(scope, rel, projectId);
  if (text !== undefined) return { path: rel, text };
  res.sendFile(abs);
}));

api.put('/files/:scope/content', wrap(async (req) => {
  const { scope, projectId } = scopeOf(req);
  const { path: rel, text } = req.body as { path: string; text: string };
  if (!rel) throw new HttpError(400, 'path required');
  await store.writeTextFile(scope, rel, text ?? '', projectId);
}));

api.post('/files/:scope/upload', upload.array('files', 50), wrap(async (req) => {
  const { scope, projectId } = scopeOf(req);
  const dir = String(req.body?.dir ?? '');
  const files = (req.files as Express.Multer.File[]) ?? [];
  const saved: string[] = [];
  for (const f of files) {
    // multer decodes filenames as latin1; recover UTF-8 names (diacritics).
    const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
    saved.push(...(await store.saveUpload(scope, dir, name, f.buffer, projectId)));
  }
  return { saved };
}));

api.post('/files/:scope/rename', wrap(async (req) => {
  const { scope, projectId } = scopeOf(req);
  const { from, to } = req.body as { from: string; to: string };
  if (!from || !to) throw new HttpError(400, 'from and to required');
  await store.renameFile(scope, from, to, projectId);
}));

api.delete('/files/:scope', wrap(async (req) => {
  const { scope, projectId } = scopeOf(req);
  await store.deleteFile(scope, String(req.query.path ?? ''), projectId);
}));

// ---------- projects (games) ----------
api.get('/projects', wrap(() => store.listProjects()));
api.post('/projects', wrap((req) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) throw new HttpError(400, 'name required');
  return store.createProject(name, String(req.body?.description ?? ''));
}));
api.get('/projects/:id', wrap((req) => store.getProject(req.params.id)));
api.patch('/projects/:id', wrap((req) => store.updateProject(req.params.id, req.body)));
api.delete('/projects/:id', wrap(async (req) => {
  for (const s of await store.listSessions(req.params.id)) await terminals.kill(s.id).catch(() => undefined);
  await store.deleteProject(req.params.id);
}));

// ---------- sessions (owner = project id, or _global / _app) ----------
const KINDS: SessionKind[] = ['work', 'instructions', 'app'];

api.get('/sessions/:owner', wrap((req) => store.listSessions(req.params.owner)));
api.post('/sessions/:owner', wrap((req) => {
  const kind = req.body?.kind as SessionKind;
  if (!KINDS.includes(kind)) throw new HttpError(400, 'kind must be work, instructions or app');
  return store.createSession(req.params.owner, kind, req.body?.title);
}));

api.get('/sessions/:owner/:sid', wrap(async (req) => {
  const session = await store.getSession(req.params.owner, req.params.sid);
  const status = await terminals.status(session.id).catch(() => ({ launched: false, alive: false, exitCode: null }));
  return { session, status };
}));

api.patch('/sessions/:owner/:sid', wrap((req) => store.updateSession(req.params.owner, req.params.sid, req.body)));

api.delete('/sessions/:owner/:sid', wrap(async (req) => {
  await terminals.kill(req.params.sid).catch(() => undefined);
  await store.deleteSession(req.params.owner, req.params.sid);
}));

/** Generates the context and starts (or restarts) the assistant in the session's terminal. */
api.post('/sessions/:owner/:sid/launch', wrap(async (req) => {
  const { owner, sid } = req.params;
  let session = await store.getSession(owner, sid);
  const status = await terminals.status(session.id);
  if (status.alive && !req.body?.restart) return { session, status };
  if (status.alive) await terminals.kill(session.id);
  if (req.body?.fresh) session = await store.updateSession(owner, sid, { launches: 0 });
  const settings = await store.getSettings();
  const contextFile = await store.writeContextFile(owner, sid, await buildContext(session));
  const launch = buildLaunch({ ...session, agent: settings.agent }, contextFile, settings);
  await terminals.spawn(session.id, launch);
  session = await store.updateSession(owner, sid, { launches: session.launches + 1, agent: settings.agent });
  return { session, status: await terminals.status(session.id) };
}));

api.post('/sessions/:owner/:sid/stop', wrap(async (req) => { await terminals.kill(req.params.sid); }));

/** The generated context, for the curious. */
api.get('/sessions/:owner/:sid/context', wrap(async (req) => ({ text: await buildContext(await store.getSession(req.params.owner, req.params.sid)) })));

/** Quit: stop every process the launcher started (terminal host, API, UI server). */
api.post('/quit', wrap(async (_req, res) => {
  res.json({ ok: true });
  const pidsFile = path.join(RUN_DIR, 'pids.json');
  let pids: number[] = [];
  try {
    const data = JSON.parse(fs.readFileSync(pidsFile, 'utf8')) as Record<string, unknown>;
    pids = Object.values(data).filter((v): v is number => typeof v === 'number');
    fs.unlinkSync(pidsFile);
  } catch { /* not started via the launcher */ }
  const signalAll = (signal: NodeJS.Signals) => {
    for (const pid of pids) {
      try {
        if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
        else process.kill(-pid, signal); // the launcher starts each one as its own process group
      } catch { /* already gone */ }
    }
  };
  setTimeout(() => {
    signalAll('SIGTERM');
    // The Vite dev server ignores SIGTERM when detached; make sure nothing lingers.
    setTimeout(() => { signalAll('SIGKILL'); process.exit(0); }, 1500);
  }, 300);
}));

// ---------- app guide (shown in the UI's help panel) ----------
api.get('/app-guide', wrap(() => ({ text: fs.readFileSync(path.join(APP_DIR, 'APP_GUIDE.md'), 'utf8') })));
