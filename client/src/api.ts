import type {
  ChatMessage, ContextFile, ContextSelection, HealthInfo, PermissionRequest, Project, Scope, Session,
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

function scopeQuery(scope: Scope, projectId?: string): string {
  return scope === 'project' ? `?project=${encodeURIComponent(projectId ?? '')}` : '';
}

export const api = {
  health: () => request<HealthInfo>('/api/health'),
  appGuide: () => request<{ text: string }>('/api/app-guide'),

  // files
  listFiles: (scope: Scope, projectId?: string) => request<ContextFile[]>(`/api/files/${scope}${scopeQuery(scope, projectId)}`),
  readFile: (scope: Scope, path: string, projectId?: string) =>
    request<{ path: string; text: string }>(`/api/files/${scope}/content${scopeQuery(scope, projectId)}${scope === 'project' ? '&' : '?'}path=${encodeURIComponent(path)}`),
  fileUrl: (scope: Scope, path: string, projectId?: string) =>
    `/api/files/${scope}/content${scopeQuery(scope, projectId)}${scope === 'project' ? '&' : '?'}path=${encodeURIComponent(path)}`,
  writeFile: (scope: Scope, path: string, text: string, projectId?: string) =>
    request(`/api/files/${scope}/content${scopeQuery(scope, projectId)}`, json('PUT', { path, text })),
  upload: (scope: Scope, files: FileList | File[], dir: string, projectId?: string) => {
    const fd = new FormData();
    fd.append('dir', dir);
    for (const f of Array.from(files)) fd.append('files', f);
    return request<{ saved: string[] }>(`/api/files/${scope}/upload${scopeQuery(scope, projectId)}`, { method: 'POST', body: fd });
  },
  renameFile: (scope: Scope, from: string, to: string, projectId?: string) =>
    request(`/api/files/${scope}/rename${scopeQuery(scope, projectId)}`, json('POST', { from, to })),
  deleteFile: (scope: Scope, path: string, projectId?: string) =>
    request(`/api/files/${scope}${scopeQuery(scope, projectId)}${scope === 'project' ? '&' : '?'}path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  // projects
  listProjects: () => request<Project[]>('/api/projects'),
  createProject: (name: string, description = '') => request<Project>('/api/projects', json('POST', { name, description })),
  updateProject: (id: string, patch: Partial<Project>) => request<Project>(`/api/projects/${id}`, json('PATCH', patch)),
  deleteProject: (id: string) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  contextDefaults: (id: string) => request<ContextSelection>(`/api/projects/${id}/context-defaults`),

  // sessions
  listSessions: (projectId: string) => request<Session[]>(`/api/projects/${projectId}/sessions`),
  createSession: (projectId: string, init: Partial<Session> = {}) => request<Session>(`/api/projects/${projectId}/sessions`, json('POST', init)),
  getSession: (projectId: string, sid: string) =>
    request<{ session: Session; messages: ChatMessage[]; running: boolean; pending: PermissionRequest[] }>(`/api/projects/${projectId}/sessions/${sid}`),
  updateSession: (projectId: string, sid: string, patch: Partial<Session>) =>
    request<Session>(`/api/projects/${projectId}/sessions/${sid}`, json('PATCH', patch)),
  deleteSession: (projectId: string, sid: string) => request(`/api/projects/${projectId}/sessions/${sid}`, { method: 'DELETE' }),
  contextPreview: (projectId: string, sid: string) =>
    request<{ systemPrompt: string; tokens: number; inline: number; reference: number }>(`/api/projects/${projectId}/sessions/${sid}/context`),
  sendMessage: (projectId: string, sid: string, text: string) =>
    request(`/api/projects/${projectId}/sessions/${sid}/messages`, json('POST', { text })),
  abort: (projectId: string, sid: string) => request(`/api/projects/${projectId}/sessions/${sid}/abort`, json('POST')),
  resolvePermission: (projectId: string, sid: string, rid: string, allow: boolean) =>
    request(`/api/projects/${projectId}/sessions/${sid}/permissions/${rid}`, json('POST', { allow })),
  eventsUrl: (projectId: string, sid: string) => `/api/projects/${projectId}/sessions/${sid}/events`,
};
