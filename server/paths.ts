import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works both from server/ (tsx) and dist/server/ (compiled).
export const APP_DIR = path.resolve(here, here.includes(`${path.sep}dist${path.sep}`) ? '../..' : '..');
export const WORKSPACE_DIR = process.env.WORKSPACE_DIR
  ? path.resolve(process.env.WORKSPACE_DIR)
  : path.join(APP_DIR, 'workspace');
export const GLOBAL_DIR = path.join(WORKSPACE_DIR, 'global');
export const PROJECTS_DIR = path.join(WORKSPACE_DIR, 'projects');
/** Sessions that don't belong to a game (instruction edits, app changes). */
export const SYSTEM_SESSIONS_DIR = path.join(WORKSPACE_DIR, '_sessions');
/** Machine-local, git-ignored state (saved credentials). */
export const LOCAL_DIR = path.join(WORKSPACE_DIR, '.local');

export function projectDir(projectId: string): string {
  return path.join(PROJECTS_DIR, safeSegment(projectId));
}

/** Where an owner's sessions live. Owners starting with "_" are system owners, not games. */
export function sessionsDir(owner: string): string {
  safeSegment(owner);
  return owner.startsWith('_') ? path.join(SYSTEM_SESSIONS_DIR, owner) : path.join(projectDir(owner), 'sessions');
}
export function sessionDir(owner: string, sessionId: string): string {
  return path.join(sessionsDir(owner), safeSegment(sessionId));
}

/**
 * The Claude Code binary bundled with the Agent SDK (installed as a platform-specific
 * optional dependency). Falls back to a `claude` on PATH.
 */
export function claudeBinary(): string {
  const platform = `${process.platform}-${process.arch}`;
  const candidates = [
    path.join(APP_DIR, 'node_modules', '@anthropic-ai', `claude-agent-sdk-${platform}`, process.platform === 'win32' ? 'claude.exe' : 'claude'),
    path.join(APP_DIR, 'node_modules', '@anthropic-ai', `claude-agent-sdk-${platform}-musl`, 'claude'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return 'claude';
}

/** Reject path segments that could escape a directory. */
export function safeSegment(segment: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(segment) || segment === '.' || segment === '..') {
    throw new HttpError(400, `Invalid identifier: ${segment}`);
  }
  return segment;
}

/** Resolve a user-supplied relative path inside root, refusing traversal. */
export function safeJoin(root: string, relative: string): string {
  const normalized = path.normalize(relative).replace(/^([/\\])+/, '');
  const abs = path.resolve(root, normalized);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new HttpError(400, `Path escapes its root: ${relative}`);
  }
  return abs;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'project';
}
