import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type ChatMessage, type ContextFile, type ContextSelection, type Project,
  type Scope, type Session, DEFAULT_MODEL, TEXT_EXTENSIONS, effectiveMode, estimateTokens, fileKey,
} from '../shared/types.js';
import {
  GLOBAL_DIR, PROJECTS_DIR, HttpError, projectDir, safeJoin, safeSegment, sessionDir, sessionsDir, slugify,
} from './paths.js';

// ---------- helpers ----------

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readJson<T>(p: string): Promise<T | undefined> {
  try { return JSON.parse(await fs.readFile(p, 'utf8')) as T; } catch { return undefined; }
}

async function writeJson(p: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, p);
}

export function isTextFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Directories inside a project that are not context material. */
const PROJECT_SKIP = new Set(['sessions', 'project.json']);
const ALWAYS_SKIP = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep']);

export function scopeRoot(scope: Scope, projectId?: string): string {
  if (scope === 'global') return GLOBAL_DIR;
  if (!projectId) throw new HttpError(400, 'projectId required for project scope');
  return projectDir(projectId);
}

// ---------- files ----------

export async function listFiles(scope: Scope, projectId?: string): Promise<ContextFile[]> {
  const root = scopeRoot(scope, projectId);
  await fs.mkdir(root, { recursive: true });
  const out: ContextFile[] = [];
  async function walk(dir: string, rel: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (ALWAYS_SKIP.has(e.name) || e.name.startsWith('.')) continue;
      if (scope === 'project' && rel === '' && PROJECT_SKIP.has(e.name)) continue;
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(abs, relPath); continue; }
      if (!e.isFile()) continue;
      const st = await fs.stat(abs);
      const kind = isTextFile(e.name) ? 'text' : 'binary';
      out.push({
        scope, path: relPath, size: st.size, mtime: st.mtimeMs, kind,
        tokens: kind === 'text' ? estimateTokens(st.size) : 0,
      });
    }
  }
  await walk(root, '');
  return out;
}

export async function readFile(scope: Scope, relPath: string, projectId?: string): Promise<{ abs: string; text?: string }> {
  const abs = safeJoin(scopeRoot(scope, projectId), relPath);
  if (!(await exists(abs))) throw new HttpError(404, `No such file: ${relPath}`);
  if (isTextFile(abs)) return { abs, text: await fs.readFile(abs, 'utf8') };
  return { abs };
}

export async function writeTextFile(scope: Scope, relPath: string, text: string, projectId?: string): Promise<void> {
  const abs = safeJoin(scopeRoot(scope, projectId), relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, text, 'utf8');
}

export async function saveUpload(scope: Scope, relDir: string, name: string, data: Buffer, projectId?: string): Promise<string> {
  const cleanName = path.basename(name).replace(/[^\w.() \-À-ɏ]+/g, '_');
  const rel = relDir ? `${relDir.replace(/\/+$/, '')}/${cleanName}` : cleanName;
  const abs = safeJoin(scopeRoot(scope, projectId), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  return rel;
}

export async function deleteFile(scope: Scope, relPath: string, projectId?: string): Promise<void> {
  const abs = safeJoin(scopeRoot(scope, projectId), relPath);
  await fs.rm(abs, { force: true });
}

export async function renameFile(scope: Scope, from: string, to: string, projectId?: string): Promise<void> {
  const root = scopeRoot(scope, projectId);
  const absTo = safeJoin(root, to);
  await fs.mkdir(path.dirname(absTo), { recursive: true });
  await fs.rename(safeJoin(root, from), absTo);
}

export { effectiveMode };

// ---------- projects ----------

const PROJECT_TEMPLATES: Record<string, string> = {
  'glossary-en-cz.md': `# {{name}} — EN → CZ glossary

Source of truth for terminology. One row per term. Mark unconfirmed entries with (proposed).

| English | Czech | Part of speech / notes | Emphasis (bold/italic/plain) |
|---|---|---|---|
| victory point | bod | pl. body | bold on first use |
`,
  'changelog.md': `# {{name}} — changelog

Newest first. One entry per review round: date, task, what changed, why.

## (no rounds yet)
`,
  'buglist.md': `# {{name}} — buglist

Findings from review rounds. Append only; update the Status column instead of deleting rows.
Types: Meaning · Terminology · Formatting · Language · Style. Status: open · fixed · rejected.

| # | Where | Passage | Type | Problem | Suggested fix | Status |
|---|---|---|---|---|---|---|
`,
};

export async function listProjects(): Promise<Project[]> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects: Project[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = await readJson<Project>(path.join(PROJECTS_DIR, e.name, 'project.json'));
    if (p) projects.push(p);
  }
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

export async function getProject(id: string): Promise<Project> {
  const p = await readJson<Project>(path.join(projectDir(id), 'project.json'));
  if (!p) throw new HttpError(404, `No such project: ${id}`);
  return p;
}

export async function createProject(name: string, description = ''): Promise<Project> {
  const base = slugify(name);
  let id = base;
  for (let i = 2; await exists(projectDir(id)); i++) id = `${base}-${i}`;
  const project: Project = { id, name: name.trim() || id, description, createdAt: new Date().toISOString(), defaults: {} };
  const dir = projectDir(id);
  for (const sub of ['context/original', 'context/translation', 'output', 'sessions']) {
    await fs.mkdir(path.join(dir, sub), { recursive: true });
  }
  // The three tracking documents every review round reads and updates.
  for (const [file, text] of Object.entries(PROJECT_TEMPLATES)) {
    await fs.writeFile(path.join(dir, 'context', file), text.replaceAll('{{name}}', project.name), 'utf8');
  }
  await writeJson(path.join(dir, 'project.json'), project);
  return project;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project> {
  const current = await getProject(id);
  const next: Project = { ...current, ...patch, id: current.id, createdAt: current.createdAt };
  await writeJson(path.join(projectDir(id), 'project.json'), next);
  return next;
}

export async function deleteProject(id: string): Promise<void> {
  await getProject(id);
  await fs.rm(projectDir(id), { recursive: true, force: true });
}

// ---------- sessions ----------

export async function listSessions(projectId: string): Promise<Session[]> {
  const dir = sessionsDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const sessions: Session[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const s = await readJson<Session>(path.join(dir, e.name, 'session.json'));
    if (s) sessions.push(s);
  }
  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sessions;
}

export async function getSession(projectId: string, sessionId: string): Promise<Session> {
  const s = await readJson<Session>(path.join(sessionDir(projectId, sessionId), 'session.json'));
  if (!s) throw new HttpError(404, `No such session: ${sessionId}`);
  return s;
}

export async function createSession(projectId: string, init: Partial<Session> = {}): Promise<Session> {
  const project = await getProject(projectId);
  // Snapshot the effective selection so later changes to project defaults don't silently alter it.
  const files = [...(await listFiles('global')), ...(await listFiles('project', projectId))];
  const context: ContextSelection = {};
  for (const f of files) context[fileKey(f.scope, f.path)] = effectiveMode(f, project.defaults);
  const now = new Date().toISOString();
  const session: Session = {
    id: randomUUID().slice(0, 8),
    projectId,
    title: init.title || 'New session',
    createdAt: now,
    updatedAt: now,
    context: init.context ?? context,
    model: init.model ?? project.model ?? DEFAULT_MODEL,
    effort: init.effort ?? 'high',
    totalCostUsd: 0,
  };
  await writeJson(path.join(sessionDir(projectId, session.id), 'session.json'), session);
  await writeJson(path.join(sessionDir(projectId, session.id), 'messages.json'), []);
  return session;
}

export async function updateSession(projectId: string, sessionId: string, patch: Partial<Session>): Promise<Session> {
  const current = await getSession(projectId, sessionId);
  const next: Session = {
    ...current, ...patch, id: current.id, projectId: current.projectId, createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(path.join(sessionDir(projectId, sessionId), 'session.json'), next);
  return next;
}

export async function deleteSession(projectId: string, sessionId: string): Promise<void> {
  safeSegment(sessionId);
  await fs.rm(sessionDir(projectId, sessionId), { recursive: true, force: true });
}

export async function getMessages(projectId: string, sessionId: string): Promise<ChatMessage[]> {
  return (await readJson<ChatMessage[]>(path.join(sessionDir(projectId, sessionId), 'messages.json'))) ?? [];
}

export async function saveMessages(projectId: string, sessionId: string, messages: ChatMessage[]): Promise<void> {
  await writeJson(path.join(sessionDir(projectId, sessionId), 'messages.json'), messages);
}
