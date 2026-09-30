import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HealthInfo, Project, Scope, Session, SessionKind } from '../../shared/types';
import { api } from './api';
import { Nav } from './components/Nav';
import { HelpModal } from './components/HelpModal';
import { FileEditor } from './components/FileEditor';
import { InstructionsPage } from './pages/InstructionsPage';
import { AppPage } from './pages/AppPage';
import { GamePage } from './pages/GamePage';
import { SessionPage } from './pages/SessionPage';

export type View =
  | { type: 'instructions' }
  | { type: 'app' }
  | { type: 'game'; id: string }
  | { type: 'session'; owner: string; id: string }
  | { type: 'file'; scope: Scope; path: string; projectId?: string; back: View };

export interface Shell {
  projects: Project[];
  health: HealthInfo | null;
  go: (v: View) => void;
  report: (e: unknown) => void;
  refreshProjects: () => Promise<Project[]>;
  refreshHealth: () => Promise<boolean>;
  openSession: (owner: string, kind: SessionKind) => Promise<void>;
}

const VIEW_KEY = 'view';

function loadView(): View {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '') as View;
    if (v && v.type !== 'file') return v;
  } catch { /* first run */ }
  return { type: 'instructions' };
}

export function App() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>(loadView);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = useCallback((err: unknown) => setError(err instanceof Error ? err.message : String(err)), []);

  /** Health is polled, not reported as an error: the API server may still be starting or restarting. */
  const refreshHealth = useCallback(async () => {
    try { setHealth(await api.health()); return true; } catch { return false; }
  }, []);

  const refreshProjects = useCallback(async () => {
    const list = await api.listProjects();
    setProjects(list);
    return list;
  }, []);

  useEffect(() => {
    let stop = false;
    let loadedProjects = false;
    const tick = async () => {
      if (stop) return;
      const ok = await refreshHealth();
      if (ok && !loadedProjects) { loadedProjects = true; refreshProjects().catch(report); }
      setTimeout(tick, ok ? 30_000 : 2_000);
    };
    void tick();
    return () => { stop = true; };
  }, [refreshHealth, refreshProjects, report]);

  useEffect(() => {
    if (view.type !== 'file') localStorage.setItem(VIEW_KEY, JSON.stringify(view));
  }, [view]);

  // If a game was deleted elsewhere, fall back.
  useEffect(() => {
    if (view.type === 'game' && projects.length && !projects.some((p) => p.id === view.id)) setView({ type: 'instructions' });
  }, [projects, view]);

  const go = useCallback((v: View) => { setView(v); window.scrollTo(0, 0); }, []);

  const openSession = useCallback(async (owner: string, kind: SessionKind) => {
    try {
      const s: Session = await api.createSession(owner, kind);
      go({ type: 'session', owner, id: s.id });
    } catch (e) { report(e); }
  }, [go, report]);

  const shell: Shell = useMemo(() => ({
    projects, health, go, report, refreshProjects, refreshHealth, openSession,
  }), [projects, health, go, report, refreshProjects, refreshHealth, openSession]);

  let page;
  switch (view.type) {
    case 'instructions': page = <InstructionsPage shell={shell} />; break;
    case 'app': page = <AppPage shell={shell} onHelp={() => setShowHelp(true)} />; break;
    case 'game': {
      const project = projects.find((p) => p.id === view.id);
      page = project ? <GamePage key={project.id} shell={shell} project={project} /> : <div className="page"><p className="muted">Loading…</p></div>;
      break;
    }
    case 'session': page = <SessionPage key={view.id} shell={shell} owner={view.owner} sessionId={view.id} />; break;
    case 'file':
      page = (
        <FileEditor
          key={`${view.scope}:${view.path}`}
          file={{ scope: view.scope, path: view.path }}
          projectId={view.projectId}
          onClose={() => go(view.back)}
          onError={report}
        />
      );
      break;
  }

  return (
    <div className="app">
      <Nav
        projects={projects}
        view={view}
        health={health}
        onGo={go}
        onNewGame={async (name) => {
          try { const p = await api.createProject(name); await refreshProjects(); go({ type: 'game', id: p.id }); } catch (e) { report(e); }
        }}
        onHelp={() => setShowHelp(true)}
      />
      <main className="main">
        {error && (
          <div className="banner error row">
            <span className="grow">{error}</span>
            <button className="icon-btn" onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {page}
      </main>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
