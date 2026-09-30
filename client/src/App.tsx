import { useCallback, useEffect, useState } from 'react';
import type { ContextFile, HealthInfo, Project, Scope, Session } from '../../shared/types';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { ContextPanel } from './components/ContextPanel';
import { FileEditor } from './components/FileEditor';
import { HelpModal } from './components/HelpModal';

export interface OpenFile { scope: Scope; path: string }

export function App() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(() => localStorage.getItem('projectId'));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [globalFiles, setGlobalFiles] = useState<ContextFile[]>([]);
  const [projectFiles, setProjectFiles] = useState<ContextFile[]>([]);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideAuthHint, setHideAuthHint] = useState(() => localStorage.getItem('hideAuthHint') === '1');

  const project = projects.find((p) => p.id === projectId) ?? null;
  const session = sessions.find((s) => s.id === sessionId) ?? null;

  const report = (err: unknown) => setError(err instanceof Error ? err.message : String(err));

  const refreshProjects = useCallback(async () => {
    const list = await api.listProjects();
    setProjects(list);
    return list;
  }, []);

  const refreshSessions = useCallback(async (pid: string) => {
    const list = await api.listSessions(pid);
    setSessions(list);
    return list;
  }, []);

  const refreshFiles = useCallback(async (pid: string | null) => {
    setGlobalFiles(await api.listFiles('global'));
    setProjectFiles(pid ? await api.listFiles('project', pid) : []);
  }, []);

  // initial load
  useEffect(() => {
    api.health().then(setHealth).catch(report);
    refreshProjects().then((list) => {
      if (list.length && !list.some((p) => p.id === projectId)) setProjectId(list[0].id);
    }).catch(report);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // project changed
  useEffect(() => {
    if (projectId) localStorage.setItem('projectId', projectId);
    setSessionId(null);
    setOpenFile(null);
    if (!projectId) { setSessions([]); return; }
    refreshSessions(projectId).then((list) => {
      const last = localStorage.getItem(`session:${projectId}`);
      if (last && list.some((s) => s.id === last)) setSessionId(last);
    }).catch(report);
    refreshFiles(projectId).catch(report);
  }, [projectId, refreshSessions, refreshFiles]);

  useEffect(() => {
    if (projectId && sessionId) localStorage.setItem(`session:${projectId}`, sessionId);
  }, [projectId, sessionId]);

  // ---- actions ----
  const createProject = async (name: string) => {
    try {
      const p = await api.createProject(name);
      await refreshProjects();
      setProjectId(p.id);
    } catch (e) { report(e); }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Delete this project, its files and all its sessions? This cannot be undone.')) return;
    try {
      await api.deleteProject(id);
      const list = await refreshProjects();
      setProjectId(list[0]?.id ?? null);
    } catch (e) { report(e); }
  };

  const createSession = async () => {
    if (!projectId) return;
    try {
      const s = await api.createSession(projectId);
      await refreshSessions(projectId);
      setSessionId(s.id);
      setOpenFile(null);
    } catch (e) { report(e); }
  };

  const deleteSession = async (id: string) => {
    if (!projectId) return;
    if (!confirm('Delete this session?')) return;
    try {
      await api.deleteSession(projectId, id);
      const list = await refreshSessions(projectId);
      if (sessionId === id) setSessionId(list[0]?.id ?? null);
    } catch (e) { report(e); }
  };

  const updateSession = (s: Session) => setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  const updateProject = (p: Project) => setProjects((prev) => prev.map((x) => (x.id === p.id ? p : x)));

  return (
    <div className={`app${project ? '' : ' no-right'}`}>
      <Sidebar
        projects={projects}
        projectId={projectId}
        sessions={sessions}
        sessionId={sessionId}
        health={health}
        onSelectProject={setProjectId}
        onCreateProject={createProject}
        onDeleteProject={deleteProject}
        onSelectSession={(id) => { setSessionId(id); setOpenFile(null); }}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        onHelp={() => setShowHelp(true)}
      />

      <div className="main">
        {error && (
          <div className="banner error row">
            <span className="grow">{error}</span>
            <button className="icon-btn" onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {health && health.auth === 'cli_login' && !hideAuthHint && (
          <div className="banner row">
            <span className="grow">
              No API key in <code>.env</code>. The agent will use your Claude Code login (<code>claude login</code>) if you have one; otherwise set <code>ANTHROPIC_API_KEY</code> in <code>.env</code> and restart.
            </span>
            <button className="icon-btn" onClick={() => { setHideAuthHint(true); localStorage.setItem('hideAuthHint', '1'); }}>✕</button>
          </div>
        )}
        {openFile ? (
          <FileEditor
            key={`${openFile.scope}:${openFile.path}`}
            file={openFile}
            projectId={projectId ?? undefined}
            onClose={() => setOpenFile(null)}
            onSaved={() => refreshFiles(projectId).catch(report)}
            onError={report}
          />
        ) : project && session ? (
          <ChatView
            key={session.id}
            project={project}
            session={session}
            models={health?.models ?? []}
            onSessionChange={updateSession}
            onError={report}
            onFilesChanged={() => refreshFiles(projectId).catch(report)}
          />
        ) : (
          <div className="empty">
            <div>
              <h2>{project ? 'No session selected' : 'No project yet'}</h2>
              {project
                ? <>Start a new session on the left. It comes preloaded with the global docs and this project's files as configured in the Context panel.</>
                : <>Create a project for the boardgame you are working on. Global instructions and methodology live in the Context panel and apply to every project.</>}
            </div>
          </div>
        )}
      </div>

      {project && (
        <ContextPanel
          project={project}
          session={session}
          globalFiles={globalFiles}
          projectFiles={projectFiles}
          onOpenFile={setOpenFile}
          onRefresh={() => refreshFiles(projectId).catch(report)}
          onSessionChange={updateSession}
          onProjectChange={updateProject}
          onError={report}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
