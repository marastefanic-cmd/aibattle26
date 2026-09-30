import type { ContextFile, HealthInfo, Project, Scope, Session, SessionKind, SessionStatus, Settings } from '../../shared/types';

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

export interface SessionInfo { session: Session; status: SessionStatus }

export const api = {
  health: () => request<HealthInfo>('/api/health'),
  appGuide: () => request<{ text: string }>('/api/app-guide'),
  updateSettings: (patch: Partial<Settings>) => request<Settings>('/api/settings', json('PUT', patch)),

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

  // sessions
  listSessions: (owner: string) => request<Session[]>(`/api/sessions/${owner}`),
  createSession: (owner: string, kind: SessionKind, title?: string) =>
    request<Session>(`/api/sessions/${owner}`, json('POST', { kind, title })),
  getSession: (owner: string, sid: string) => request<SessionInfo>(`/api/sessions/${owner}/${sid}`),
  updateSession: (owner: string, sid: string, patch: Partial<Session>) =>
    request<Session>(`/api/sessions/${owner}/${sid}`, json('PATCH', patch)),
  deleteSession: (owner: string, sid: string) => request(`/api/sessions/${owner}/${sid}`, { method: 'DELETE' }),
  launchSession: (owner: string, sid: string, opts: { restart?: boolean; fresh?: boolean } = {}) =>
    request<SessionInfo>(`/api/sessions/${owner}/${sid}/launch`, json('POST', opts)),
  stopSession: (owner: string, sid: string) => request(`/api/sessions/${owner}/${sid}/stop`, json('POST')),
  sessionContext: (owner: string, sid: string) => request<{ text: string }>(`/api/sessions/${owner}/${sid}/context`),
  terminalUrl: (sid: string) => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/term/${sid}`,
};
