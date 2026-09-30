import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentInfo, AgentKind, Session, Settings } from '../shared/types.js';
import { APP_DIR, HttpError } from './paths.js';

const WIN = process.platform === 'win32';

/** Finds an executable: first in this app's node_modules/.bin, then on PATH. */
function findExecutable(name: string): string | undefined {
  const local = path.join(APP_DIR, 'node_modules', '.bin', WIN ? `${name}.cmd` : name);
  if (fs.existsSync(local)) return local;
  try {
    const out = execFileSync(WIN ? 'where' : 'which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const first = out.split(/\r?\n/).find((l) => l.trim());
    if (first) return first.trim();
  } catch { /* not found */ }
  return undefined;
}

export function agentInfos(settings: Settings): AgentInfo[] {
  const claude = findExecutable('claude');
  const codex = findExecutable('codex');
  return [
    {
      kind: 'claude', label: 'Claude Code', available: Boolean(claude), path: claude,
      installHint: 'Installed with this app. If missing, run "npm install" in the app folder.',
    },
    {
      kind: 'codex', label: 'Codex (ChatGPT)', available: Boolean(codex), path: codex,
      installHint: 'Install with: npm install -g @openai/codex',
    },
    {
      kind: 'custom', label: 'Custom command', available: settings.customCommand.trim().length > 0,
      installHint: 'Enter the command to run. {context} is replaced by the context file, {cwd} by the app folder.',
    },
  ];
}

export interface Launch {
  file: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

/**
 * Builds the command that starts the assistant for a session. The assistant always
 * runs in the app folder so it can reach both the workspace and the app's code.
 */
export function buildLaunch(session: Session, contextFile: string, settings: Settings): Launch {
  const kind: AgentKind = session.agent;
  const infos = agentInfos(settings);
  const info = infos.find((a) => a.kind === kind)!;
  if (!info.available) throw new HttpError(400, `${info.label} is not available. ${info.installHint}`);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  Object.assign(env, { TERM: 'xterm-256color', COLORTERM: 'truecolor', LANG: env.LANG ?? 'en_US.UTF-8' });

  const readFirst = `Before anything else, read the file ${contextFile} and follow it — it describes your role, the persistent instructions and the files for this task.`;

  switch (kind) {
    case 'claude': {
      const args = [
        '--append-system-prompt-file', contextFile,
        '--permission-mode', 'acceptEdits',
        ...(session.launches > 0 ? ['--resume', session.id] : ['--session-id', session.id]),
        ...(settings.claudeModel.trim() ? ['--model', settings.claudeModel.trim()] : []),
      ];
      return wrap(info.path!, args, env);
    }
    case 'codex':
      return wrap(info.path!, ['--cd', APP_DIR, readFirst], env);
    case 'custom': {
      const cmd = settings.customCommand
        .replaceAll('{context}', quote(contextFile))
        .replaceAll('{cwd}', quote(APP_DIR))
        .replaceAll('{prompt}', quote(readFirst));
      return WIN
        ? { file: 'cmd.exe', args: ['/d', '/s', '/c', cmd], cwd: APP_DIR, env }
        : { file: '/bin/sh', args: ['-c', cmd], cwd: APP_DIR, env };
    }
  }
}

function wrap(file: string, args: string[], env: Record<string, string>): Launch {
  // .cmd shims on Windows must go through cmd.exe.
  if (WIN && /\.(cmd|bat)$/i.test(file)) return { file: 'cmd.exe', args: ['/d', '/s', '/c', file, ...args], cwd: APP_DIR, env };
  return { file, args, cwd: APP_DIR, env };
}

function quote(s: string): string {
  return WIN ? `"${s.replaceAll('"', '""')}"` : `'${s.replaceAll("'", `'\\''`)}'`;
}
