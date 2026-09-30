// Types shared between the server and the client.

export type Scope = 'global' | 'project';

/** How a context file is handed to the agent at session start. */
export type FileMode =
  | 'inline' // full content is placed in the system prompt
  | 'reference' // only the path is listed; the agent reads it on demand
  | 'off'; // not mentioned at all

export type FileKind = 'text' | 'binary';

export interface ContextFile {
  scope: Scope;
  /** Path relative to the scope root (global dir or project dir). */
  path: string;
  size: number;
  mtime: number;
  kind: FileKind;
  /** Rough token estimate (chars / 4) for text files. */
  tokens: number;
}

/** Map of "scope:path" -> mode. Files not present fall back to defaults. */
export type ContextSelection = Record<string, FileMode>;

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  /** Default context selection for new sessions in this project. */
  defaults: ContextSelection;
  model?: string;
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Claude Agent SDK session id, set after the first turn. */
  sdkSessionId?: string;
  context: ContextSelection;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  totalCostUsd: number;
}

export type Block =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: string;
  blocks: Block[];
  /** Set on assistant messages while the turn is still streaming. */
  streaming?: boolean;
  error?: string;
}

export interface PermissionRequest {
  id: string;
  sessionId: string;
  toolName: string;
  input: Record<string, unknown>;
  createdAt: string;
}

/** Server -> client events over SSE. */
export type ServerEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'text_delta'; messageId: string; text: string }
  | { type: 'thinking_delta'; messageId: string; text: string }
  | { type: 'turn_end'; messageId: string; costUsd?: number }
  | { type: 'permission_request'; request: PermissionRequest }
  | { type: 'permission_resolved'; requestId: string }
  | { type: 'session'; session: Session }
  | { type: 'status'; text: string }
  | { type: 'error'; text: string };

export interface HealthInfo {
  ok: boolean;
  /** Where credentials come from: a .env/environment variable, or whatever the Claude Code CLI login provides. */
  auth: 'api_key' | 'oauth_token' | 'cli_login';
  workspaceDir: string;
  appDir: string;
  models: string[];
}

export const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1'];
export const DEFAULT_MODEL = 'claude-opus-5-5';

export const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.csv', '.tsv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm',
  '.ts', '.tsx', '.js', '.jsx', '.css', '.srt', '.po', '.ini', '.toml', '.tex', '.rtf',
]);

export function fileKey(scope: Scope, path: string): string {
  return `${scope}:${path}`;
}

export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

/** Built-in default mode for a file that has no explicit selection. */
export function defaultMode(file: ContextFile): FileMode {
  if (file.kind === 'binary') return 'reference';
  if (file.scope === 'project' && file.path.startsWith('output/')) return 'reference';
  if (file.tokens > 40_000) return 'reference';
  return 'inline';
}

/** First explicit mode found in the given layers (most specific first), else the default. */
export function effectiveMode(file: ContextFile, ...layers: (ContextSelection | undefined)[]): FileMode {
  const key = fileKey(file.scope, file.path);
  for (const layer of layers) {
    const v = layer?.[key];
    if (v) return v;
  }
  return defaultMode(file);
}

/** Rough token cost of the preamble the server adds before the context files. */
export const PREAMBLE_TOKENS = 700;
