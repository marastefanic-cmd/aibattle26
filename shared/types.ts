// Types shared between the server and the client.

export type Scope = 'global' | 'project';

export interface ContextFile {
  scope: Scope;
  /** Path relative to the scope root (global dir or project dir). */
  path: string;
  size: number;
  mtime: number;
  kind: 'text' | 'binary';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

/**
 * What a session is for:
 * - work: a review round inside a game (owner = project id)
 * - instructions: the AI edits persistent instructions (owner = GLOBAL_OWNER or a project id)
 * - app: the AI modifies this app's own source code (owner = APP_OWNER)
 */
export type SessionKind = 'work' | 'instructions' | 'app';
export const GLOBAL_OWNER = '_global';
export const APP_OWNER = '_app';

/** Which command-line AI assistant runs inside the terminal. */
export type AgentKind = 'claude' | 'codex' | 'custom';

export interface Session {
  /** A UUID: Claude Code uses it as its own conversation id so the session can be resumed. */
  id: string;
  owner: string;
  kind: SessionKind;
  title: string;
  createdAt: string;
  updatedAt: string;
  agent: AgentKind;
  /** How many times the assistant was started in this session (0 = never). */
  launches: number;
}

export interface SessionStatus {
  /** The assistant process exists in the terminal host. */
  launched: boolean;
  alive: boolean;
  exitCode?: number | null;
}

export interface Settings {
  agent: AgentKind;
  /** For agent = custom: a shell command. {context} = path of the generated context file, {cwd} = app folder. */
  customCommand: string;
  /** Optional Claude model alias (opus, sonnet, …). Empty = Claude Code's default. */
  claudeModel: string;
}

export interface AgentInfo {
  kind: AgentKind;
  label: string;
  available: boolean;
  /** Where the executable was found. */
  path?: string;
  installHint: string;
}

export interface HealthInfo {
  ok: boolean;
  workspaceDir: string;
  appDir: string;
  settings: Settings;
  agents: AgentInfo[];
  /** The terminal host process (separate from the API) is reachable. */
  terminalHost: boolean;
}

export const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.csv', '.tsv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm',
  '.ts', '.tsx', '.js', '.jsx', '.css', '.srt', '.po', '.ini', '.toml', '.tex', '.rtf',
]);

/** Office formats that are converted to text on upload; the original is kept for reference. */
export const CONVERTED_EXTENSIONS = new Set(['.docx', '.xlsx', '.xls', '.xlsm']);

export function extOf(path: string): string {
  const i = path.lastIndexOf('.');
  return i === -1 ? '' : path.slice(i).toLowerCase();
}

/** Text files above this size are listed by path instead of being inlined into the context. */
export const INLINE_LIMIT_BYTES = 120_000;
