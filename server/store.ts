import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type ContextFile, type Project, type Scope, type Session, type SessionKind, type Settings, TEXT_EXTENSIONS,
} from '../shared/types.js';
import { convertUpload } from './convert.js';
import {
  GLOBAL_DIR, PROJECTS_DIR, SETTINGS_FILE, HttpError, projectDir, safeJoin, safeSegment, sessionDir, sessionsDir, slugify,
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

/** Entries inside a project dir that are not context material. */
const PROJECT_SKIP = new Set(['sessions', 'project.json']);
const ALWAYS_SKIP = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep']);

export function scopeRoot(scope: Scope, projectId?: string): string {
  if (scope === 'global') return GLOBAL_DIR;
  if (!projectId) throw new HttpError(400, 'projectId required for project scope');
  return projectDir(projectId);
}

// ---------- settings ----------

const DEFAULT_SETTINGS: Settings = { agent: 'claude', customCommand: '', claudeModel: '' };

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await readJson<Partial<Settings>>(SETTINGS_FILE)) ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  if (!['claude', 'codex', 'custom'].includes(next.agent)) throw new HttpError(400, 'unknown agent');
  await writeJson(SETTINGS_FILE, next);
  return next;
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
      out.push({ scope, path: relPath, size: st.size, mtime: st.mtimeMs, kind: isTextFile(e.name) ? 'text' : 'binary' });
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

/** Saves an upload; office documents additionally get a text version next to them. */
export async function saveUpload(scope: Scope, relDir: string, name: string, data: Buffer, projectId?: string): Promise<string[]> {
  const cleanName = path.basename(name).replace(/[^\w.() \-À-ɏ]+/g, '_');
  const rel = relDir ? `${relDir.replace(/\/+$/, '')}/${cleanName}` : cleanName;
  const abs = safeJoin(scopeRoot(scope, projectId), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  let converted: string[] = [];
  try { converted = await convertUpload(abs, rel); } catch (err) { console.warn(`Could not convert ${rel}:`, err); }
  return [rel, ...converted];
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

// ---------- projects (games) ----------

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
  const project: Project = { id, name: name.trim() || id, description, createdAt: new Date().toISOString() };
  const dir = projectDir(id);
  for (const sub of ['context/original', 'context/translation', 'instructions', 'output', 'sessions']) {
    await fs.mkdir(path.join(dir, sub), { recursive: true });
  }
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

export async function listSessions(owner: string): Promise<Session[]> {
  const dir = sessionsDir(owner);
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

export async function getSession(owner: string, sessionId: string): Promise<Session> {
  const s = await readJson<Session>(path.join(sessionDir(owner, sessionId), 'session.json'));
  if (!s) throw new HttpError(404, `No such session: ${sessionId}`);
  return s;
}

export async function createSession(owner: string, kind: SessionKind, title?: string): Promise<Session> {
  if (kind === 'work') await getProject(owner);
  const settings = await getSettings();
  const now = new Date().toISOString();
  const session: Session = {
    id: randomUUID(),
    owner,
    kind,
    title: title?.trim() || defaultTitle(kind, now),
    createdAt: now,
    updatedAt: now,
    agent: settings.agent,
    launches: 0,
  };
  await writeJson(path.join(sessionDir(owner, session.id), 'session.json'), session);
  return session;
}

function defaultTitle(kind: SessionKind, iso: string): string {
  const when = new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return `${kind === 'app' ? 'App change' : kind === 'instructions' ? 'Instruction change' : 'Session'} · ${when}`;
}

export async function updateSession(owner: string, sessionId: string, patch: Partial<Session>): Promise<Session> {
  const current = await getSession(owner, sessionId);
  const next: Session = {
    ...current, ...patch, id: current.id, owner: current.owner, kind: current.kind, createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(path.join(sessionDir(owner, sessionId), 'session.json'), next);
  return next;
}

export async function deleteSession(owner: string, sessionId: string): Promise<void> {
  safeSegment(sessionId);
  await fs.rm(sessionDir(owner, sessionId), { recursive: true, force: true });
}

/** Writes the generated context file for a session launch and returns its absolute path. */
export async function writeContextFile(owner: string, sessionId: string, text: string): Promise<string> {
  const p = path.join(sessionDir(owner, sessionId), 'context.md');
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, text, 'utf8');
  return p;
}
