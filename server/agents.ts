import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AgentInfo, AgentKind, Session, Settings } from '../shared/types.js';
import { APP_DIR, HttpError } from './paths.js';

const WIN = process.platform === 'win32';

/**
 * Finds the Claude Code executable. Preferred: the native binary from the platform package
 * that @anthropic-ai/claude-code installs (no shell shim involved, so paths with spaces are
 * fine). Fallbacks: the package's own bin, this app's node_modules/.bin, then PATH.
 */
function findClaude(): string | undefined {
  const exe = WIN ? 'claude.exe' : 'claude';
  const platform = `${process.platform}-${process.arch}`;
  const candidates = [
    path.join(APP_DIR, 'node_modules', '@anthropic-ai', `claude-code-${platform}`, exe),
    path.join(APP_DIR, 'node_modules', '@anthropic-ai', `claude-code-${platform}-musl`, exe),
    path.join(APP_DIR, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', exe),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return findExecutable('claude');
}

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
  const claude = findClaude();
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
  /** An array normally; a single pre-quoted command line when going through cmd.exe on Windows. */
  args: string[] | string;
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
      // Resume only if Claude Code actually saved a conversation for this id (a session that was
      // opened but never used has none, and --resume would fail); otherwise start it fresh.
      const resume = session.launches > 0 && claudeTranscriptExists(session.id);
      const args = [
        '--append-system-prompt-file', contextFile,
        '--permission-mode', 'acceptEdits',
        ...(resume ? ['--resume', session.id] : ['--session-id', session.id]),
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
        ? viaCmd(cmd, env)
        : { file: '/bin/sh', args: ['-c', cmd], cwd: APP_DIR, env };
    }
  }
}

/** Claude Code stores transcripts at <config dir>/projects/<cwd with non-alphanumerics as '-'>/<id>.jsonl */
function claudeTranscriptExists(sessionId: string): boolean {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const projectKey = APP_DIR.replace(/[^A-Za-z0-9]/g, '-');
  return fs.existsSync(path.join(configDir, 'projects', projectKey, `${sessionId}.jsonl`));
}

function wrap(file: string, args: string[], env: Record<string, string>): Launch {
  // .cmd/.bat shims on Windows must go through cmd.exe, as one quoted command line.
  if (WIN && /\.(cmd|bat)$/i.test(file)) return viaCmd([file, ...args].map(quote).join(' '), env);
  return { file, args, cwd: APP_DIR, env };
}

/**
 * cmd.exe /s /c strips the first and last quote of the command line, so the whole
 * command is wrapped in one extra pair; inner quotes then survive intact.
 */
function viaCmd(commandLine: string, env: Record<string, string>): Launch {
  return { file: 'cmd.exe', args: `/d /s /c "${commandLine}"`, cwd: APP_DIR, env };
}

function quote(s: string): string {
  return WIN ? `"${s.replaceAll('"', '""')}"` : `'${s.replaceAll("'", `'\\''`)}'`;
}
