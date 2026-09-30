import type {
  AuthStatus, ChatMessage, ContextFile, ContextSelection, HealthInfo, PermissionRequest, Project, Scope, Session, SessionKind,
} from '../../shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try { message = ((await res.json()) as { error?: string }).error ?? message; } catch { /* keep default */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function q(scope: Scope, projectId: string | undefined, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (scope === 'project') params.set('project', projectId ?? '');
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const api = {
  health: () => request<HealthInfo>('/api/health'),
  appGuide: () => request<{ text: string }>('/api/app-guide'),

  // auth
  authStatus: () => request<AuthStatus>('/api/auth/status'),
  loginStart: (mode: 'claudeai' | 'console') => request<{ url: string }>('/api/auth/login/start', json('POST', { mode })),
  loginCode: (code: string) => request<AuthStatus>('/api/auth/login/code', json('POST', { code })),
  loginCancel: () => request('/api/auth/login/cancel', json('POST')),
  saveApiKey: (key: string) => request<AuthStatus>('/api/auth/api-key', json('POST', { key })),
  logout: () => request<AuthStatus>('/api/auth/logout', json('POST')),

  // files
  listFiles: (scope: Scope, projectId?: string) => request<ContextFile[]>(`/api/files/${scope}${q(scope, projectId)}`),
  readFile: (scope: Scope, path: string, projectId?: string) =>
    request<{ path: string; text: string }>(`/api/files/${scope}/content${q(scope, projectId, { path })}`),
  fileUrl: (scope: Scope, path: string, projectId?: string) => `/api/files/${scope}/content${q(scope, projectId, { path })}`,
  writeFile: (scope: Scope, path: string, text: string, projectId?: string) =>
    request(`/api/files/${scope}/content${q(scope, projectId)}`, json('PUT', { path, text })),
  upload: (scope: Scope, files: FileList | File[], dir: string, projectId?: string) => {
    const fd = new FormData();
    fd.append('dir', dir);
    for (const f of Array.from(files)) fd.append('files', f);
    return request<{ saved: string[] }>(`/api/files/${scope}/upload${q(scope, projectId)}`, { method: 'POST', body: fd });
  },
  renameFile: (scope: Scope, from: string, to: string, projectId?: string) =>
    request(`/api/files/${scope}/rename${q(scope, projectId)}`, json('POST', { from, to })),
  deleteFile: (scope: Scope, path: string, projectId?: string) =>
    request(`/api/files/${scope}${q(scope, projectId, { path })}`, { method: 'DELETE' }),

  // projects (games)
  listProjects: () => request<Project[]>('/api/projects'),
  createProject: (name: string, description = '') => request<Project>('/api/projects', json('POST', { name, description })),
  updateProject: (id: string, patch: Partial<Project>) => request<Project>(`/api/projects/${id}`, json('PATCH', patch)),
  deleteProject: (id: string) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  contextDefaults: (id: string) => request<ContextSelection>(`/api/projects/${id}/context-defaults`),

  // sessions
  listSessions: (owner: string) => request<Session[]>(`/api/sessions/${owner}`),
  createSession: (owner: string, kind: SessionKind, init: Partial<Session> = {}) =>
    request<Session>(`/api/sessions/${owner}`, json('POST', { ...init, kind })),
  getSession: (owner: string, sid: string) =>
    request<{ session: Session; messages: ChatMessage[]; running: boolean; pending: PermissionRequest[] }>(`/api/sessions/${owner}/${sid}`),
  updateSession: (owner: string, sid: string, patch: Partial<Session>) =>
    request<Session>(`/api/sessions/${owner}/${sid}`, json('PATCH', patch)),
  deleteSession: (owner: string, sid: string) => request(`/api/sessions/${owner}/${sid}`, { method: 'DELETE' }),
  contextPreview: (owner: string, sid: string) =>
    request<{ systemPrompt: string; tokens: number; inline: number; reference: number }>(`/api/sessions/${owner}/${sid}/context`),
  sendMessage: (owner: string, sid: string, text: string) => request(`/api/sessions/${owner}/${sid}/messages`, json('POST', { text })),
  abort: (owner: string, sid: string) => request(`/api/sessions/${owner}/${sid}/abort`, json('POST')),
  resolvePermission: (owner: string, sid: string, rid: string, allow: boolean) =>
    request(`/api/sessions/${owner}/${sid}/permissions/${rid}`, json('POST', { allow })),
  eventsUrl: (owner: string, sid: string) => `/api/sessions/${owner}/${sid}/events`,
};
