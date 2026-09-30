import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileKey, MODELS, type ContextSelection, type HealthInfo, type Scope, type ServerEvent } from '../shared/types.js';
import { agents } from './agent.js';
import { buildContext } from './context.js';
import { APP_DIR, HttpError, WORKSPACE_DIR } from './paths.js';
import * as store from './store.js';

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

// ---------- health ----------
api.get('/health', wrap((): HealthInfo => ({
  ok: true,
  auth: process.env.ANTHROPIC_API_KEY ? 'api_key' : process.env.CLAUDE_CODE_OAUTH_TOKEN ? 'oauth_token' : 'cli_login',
  workspaceDir: WORKSPACE_DIR,
  appDir: APP_DIR,
  models: MODELS,
})));

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
    saved.push(await store.saveUpload(scope, dir, name, f.buffer, projectId));
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

// ---------- projects ----------
api.get('/projects', wrap(() => store.listProjects()));
api.post('/projects', wrap((req) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) throw new HttpError(400, 'name required');
  return store.createProject(name, String(req.body?.description ?? ''));
}));
api.get('/projects/:id', wrap((req) => store.getProject(req.params.id)));
api.patch('/projects/:id', wrap((req) => store.updateProject(req.params.id, req.body)));
api.delete('/projects/:id', wrap((req) => store.deleteProject(req.params.id)));

/** Effective modes for every file, combining project defaults and built-in defaults. */
api.get('/projects/:id/context-defaults', wrap(async (req) => {
  const project = await store.getProject(req.params.id);
  const files = [...(await store.listFiles('global')), ...(await store.listFiles('project', project.id))];
  const effective: ContextSelection = {};
  for (const f of files) effective[fileKey(f.scope, f.path)] = store.effectiveMode(f, project.defaults);
  return effective;
}));

// ---------- sessions ----------
api.get('/projects/:id/sessions', wrap((req) => store.listSessions(req.params.id)));
api.post('/projects/:id/sessions', wrap((req) => store.createSession(req.params.id, req.body ?? {})));

api.get('/projects/:id/sessions/:sid', wrap(async (req) => {
  const { id, sid } = req.params;
  const session = await store.getSession(id, sid);
  const messages = await store.getMessages(id, sid);
  const current = agents.currentAssistant(sid);
  if (current) messages.push(current);
  return { session, messages, running: agents.isRunning(sid), pending: agents.pendingPermissions(sid) };
}));

api.patch('/projects/:id/sessions/:sid', wrap((req) => store.updateSession(req.params.id, req.params.sid, req.body)));

api.delete('/projects/:id/sessions/:sid', wrap(async (req) => {
  agents.abort(req.params.sid);
  await store.deleteSession(req.params.id, req.params.sid);
}));

/** Preview of the system prompt the agent will receive, for the context panel. */
api.get('/projects/:id/sessions/:sid/context', wrap(async (req) => {
  const project = await store.getProject(req.params.id);
  const session = await store.getSession(req.params.id, req.params.sid);
  const ctx = await buildContext(project, session);
  return { systemPrompt: ctx.systemPrompt, tokens: ctx.tokens, inline: ctx.inlineFiles.length, reference: ctx.referenceFiles.length };
}));

api.post('/projects/:id/sessions/:sid/messages', wrap(async (req) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) throw new HttpError(400, 'text required');
  await agents.send(req.params.id, req.params.sid, text);
}));

api.post('/projects/:id/sessions/:sid/abort', wrap((req) => { agents.abort(req.params.sid); }));

api.post('/projects/:id/sessions/:sid/permissions/:rid', wrap((req) => {
  agents.resolvePermission(req.params.sid, req.params.rid, Boolean(req.body?.allow));
}));

/** Server-sent events for one session. */
api.get('/projects/:id/sessions/:sid/events', (req: Req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  const send = (ev: ServerEvent) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  const unsubscribe = agents.subscribe(req.params.sid, send);
  const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
  req.on('close', () => { clearInterval(ping); unsubscribe(); });
});

// ---------- app guide (shown in the UI's help panel) ----------
api.get('/app-guide', wrap(() => ({ text: fs.readFileSync(path.join(APP_DIR, 'APP_GUIDE.md'), 'utf8') })));
