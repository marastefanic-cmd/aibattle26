import { useState } from 'react';
import type { HealthInfo, Project, Session } from '../../../shared/types';

interface Props {
  projects: Project[];
  projectId: string | null;
  sessions: Session[];
  sessionId: string | null;
  health: HealthInfo | null;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onHelp: () => void;
}

export function Sidebar(p: Props) {
  const [newProject, setNewProject] = useState<string | null>(null);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div>Rulebook <span>Studio</span></div>
        <button className="icon-btn" title="How this app works" onClick={p.onHelp}>?</button>
      </div>

      <div className="section-title">
        Projects
        <button className="icon-btn" title="New project" onClick={() => setNewProject('')}>＋</button>
      </div>
      {newProject !== null && (
        <form
          className="inline-form"
          onSubmit={(e) => { e.preventDefault(); if (newProject.trim()) { p.onCreateProject(newProject.trim()); setNewProject(null); } }}
        >
          <input
            className="text" autoFocus placeholder="Game name…" value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setNewProject(null); }}
          />
          <button className="btn primary small" type="submit">Add</button>
        </form>
      )}
      <div className="list">
        {p.projects.map((pr) => (
          <div key={pr.id} className={`list-item${pr.id === p.projectId ? ' active' : ''}`} onClick={() => p.onSelectProject(pr.id)}>
            <span className="title">{pr.name}</span>
            <button className="icon-btn" title="Delete project" onClick={(e) => { e.stopPropagation(); p.onDeleteProject(pr.id); }}>✕</button>
          </div>
        ))}
        {!p.projects.length && <div className="muted tiny" style={{ padding: '4px 14px' }}>No projects yet.</div>}
      </div>

      {p.projectId && (
        <>
          <div className="section-title">
            Sessions
            <button className="btn primary small" onClick={p.onCreateSession}>＋ New</button>
          </div>
          <div className="sessions">
            {p.sessions.map((s) => (
              <div key={s.id} className={`list-item${s.id === p.sessionId ? ' active' : ''}`} onClick={() => p.onSelectSession(s.id)}>
                <div className="title">
                  <div className="ellipsis">{s.title}</div>
                  <div className="tiny muted">{new Date(s.updatedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}{s.totalCostUsd ? ` · $${s.totalCostUsd.toFixed(2)}` : ''}</div>
                </div>
                <button className="icon-btn" title="Delete session" onClick={(e) => { e.stopPropagation(); p.onDeleteSession(s.id); }}>✕</button>
              </div>
            ))}
            {!p.sessions.length && <div className="muted tiny" style={{ padding: '4px 14px' }}>No sessions yet. Sessions are disposable: start one per task.</div>}
          </div>
        </>
      )}

      <div className="sidebar-footer">
        <span style={{ color: p.health ? 'var(--ok)' : 'var(--muted)' }}>●</span>
        <span className="grow ellipsis" title={p.health ? `Workspace: ${p.health.workspaceDir}` : undefined}>
          {p.health
            ? (p.health.auth === 'api_key' ? 'API key from .env' : p.health.auth === 'oauth_token' ? 'OAuth token from .env' : 'Claude Code login')
            : 'Connecting…'}
        </span>
      </div>
    </aside>
  );
}
