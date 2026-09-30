import { useCallback, useEffect, useState } from 'react';
import {
  type ContextFile, type ContextSelection, type FileMode, type Project, type Session,
  PREAMBLE_TOKENS, effectiveMode, fileKey,
} from '../../../shared/types';
import { api } from '../api';
import type { Shell, View } from '../App';
import { FileRows } from '../components/FileRows';
import { InstructionsSection } from '../components/InstructionsSection';
import { SessionList } from '../components/SessionList';

const FOLDERS: { dir: string; label: string }[] = [
  { dir: 'context', label: 'Other files' },
  { dir: 'context/original', label: 'Original rules' },
  { dir: 'context/translation', label: 'Translation' },
];

export function GamePage({ shell, project }: { shell: Shell; project: Project }) {
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [globalFiles, setGlobalFiles] = useState<ContextFile[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState(project.name);
  const [dir, setDir] = useState(FOLDERS[0].dir);
  const [advanced, setAdvanced] = useState(false);
  const back: View = { type: 'game', id: project.id };

  const refresh = useCallback(async () => {
    try {
      setFiles(await api.listFiles('project', project.id));
      setGlobalFiles(await api.listFiles('global'));
      setSessions((await api.listSessions(project.id)).filter((s) => s.kind === 'work'));
    } catch (e) { shell.report(e); }
  }, [project.id, shell]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => setName(project.name), [project.name]);

  const contextFiles = files.filter((f) => !f.path.startsWith('instructions/') && !f.path.startsWith('output/'));
  const outputFiles = files.filter((f) => f.path.startsWith('output/'));

  const modeOf = (f: ContextFile): FileMode => effectiveMode(f, project.defaults);
  const setMode = async (f: ContextFile, mode: FileMode) => {
    const defaults: ContextSelection = { ...project.defaults, [fileKey(f.scope, f.path)]: mode };
    try { await api.updateProject(project.id, { defaults }); await shell.refreshProjects(); } catch (e) { shell.report(e); }
  };

  const readFiles = [...globalFiles, ...contextFiles].filter((f) => modeOf(f) !== 'off');
  const words = Math.round(([...globalFiles, ...contextFiles].reduce((n, f) => n + (modeOf(f) === 'inline' ? f.tokens : 0), 0) + PREAMBLE_TOKENS) * 0.75);

  const rename = async () => {
    const n = name.trim();
    if (!n || n === project.name) { setName(project.name); return; }
    try { await api.updateProject(project.id, { name: n }); await shell.refreshProjects(); } catch (e) { shell.report(e); }
  };

  const remove = async () => {
    if (!confirm(`Delete the game "${project.name}" with all its files and sessions? This cannot be undone.`)) return;
    try { await api.deleteProject(project.id); await shell.refreshProjects(); shell.go({ type: 'instructions' }); } catch (e) { shell.report(e); }
  };

  return (
    <div className="page">
      <header className="page-head accent-game">
        <input className="h1-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} title="Click to rename" />
        <p className="lead">Everything about this game in one place: its files, its own instructions, and the sessions where the AI does the work.</p>
      </header>

      <h3>Sessions</h3>
      <button className="big-btn accent-game" onClick={() => shell.openSession(project.id, 'work')}>
        <span className="big-plus">＋</span>
        <span>
          <span className="big-title">New session</span>
          <span className="big-sub">The AI starts already knowing the instructions and this game's files. Tell it what to check.</span>
        </span>
      </button>
      <SessionList
        sessions={sessions}
        emptyText="No sessions yet. Each session is one task — a spellcheck, a terminology check, a comparison with the original…"
        onOpen={(s) => shell.go({ type: 'session', owner: project.id, id: s.id })}
        onDelete={(s) => api.deleteSession(project.id, s.id).then(refresh).catch(shell.report)}
      />

      <h3>Files for this game</h3>
      <p className="muted">Upload the original rulebook, the translation, and anything else that matters. Word and Excel files are converted to text automatically so the AI can read them. The glossary, changelog and buglist were created for you — the AI keeps them up to date.</p>
      <FileRows
        scope="project" projectId={project.id} files={contextFiles} dir={dir} hidePrefix="context/"
        emptyText="No files yet."
        onChanged={refresh}
        onOpen={(f) => shell.go({ type: 'file', scope: 'project', path: f.path, projectId: project.id, back })}
        onError={shell.report}
        dirPicker={(
          <label className="row tiny muted">Put in:
            <select className="text" style={{ width: 'auto', padding: '2px 4px' }} value={dir} onChange={(e) => setDir(e.target.value)}>
              {FOLDERS.map((f) => <option key={f.dir} value={f.dir}>{f.label}</option>)}
            </select>
          </label>
        )}
        extra={(f) => (
          <label className="check" title="Untick to hide this file from the AI in new sessions">
            <input type="checkbox" checked={modeOf(f) !== 'off'} onChange={(e) => setMode(f, e.target.checked ? (f.kind === 'text' ? 'inline' : 'reference') : 'off')} />
            AI reads this
          </label>
        )}
      />
      <p className="muted tiny">
        New sessions start with {readFiles.length} file{readFiles.length === 1 ? '' : 's'} (about {words.toLocaleString()} words preloaded).
        {' '}<button className="link-btn" onClick={() => setAdvanced((a) => !a)}>{advanced ? 'Hide details' : 'Fine-tune'}</button>
      </p>
      {advanced && (
        <div className="card">
          <p className="tiny muted">
            <b>Read at start</b>: the whole file is given to the AI before it begins (best for instructions, glossary, short documents).
            <b> Open when needed</b>: the AI only knows the file exists and opens it when it needs it (best for long PDFs).
            <b> Hidden</b>: not mentioned at all. Applies to new sessions.
          </p>
          {[...globalFiles, ...contextFiles].map((f) => (
            <div key={fileKey(f.scope, f.path)} className="file-row">
              <span className="muted tiny" style={{ width: 70 }}>{f.scope === 'global' ? 'general' : 'this game'}</span>
              <span className="grow ellipsis">{f.path}</span>
              <span className="muted tiny">{f.kind === 'text' ? `~${Math.round(f.tokens * 0.75).toLocaleString()} words` : 'file'}</span>
              <div className="seg">
                {(['inline', 'reference', 'off'] as FileMode[]).map((m) => (
                  <button key={m} className={modeOf(f) === m ? `on ${m}` : ''} disabled={m === 'inline' && f.kind !== 'text'} onClick={() => setMode(f, m)}>
                    {m === 'inline' ? 'Read at start' : m === 'reference' ? 'Open when needed' : 'Hidden'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {outputFiles.length > 0 && (
        <>
          <h3>Results from the AI</h3>
          <FileRows
            scope="project" projectId={project.id} files={outputFiles} dir="output" hidePrefix="output/"
            emptyText="" uploadLabel="Add a file"
            onChanged={refresh}
            onOpen={(f) => shell.go({ type: 'file', scope: 'project', path: f.path, projectId: project.id, back })}
            onError={shell.report}
          />
        </>
      )}

      <h3 className="accent-instructions-text">★ Instructions just for this game</h3>
      <p className="muted">Rules that apply only to this game (its special terms, tone, exceptions). They are added on top of the general persistent instructions.</p>
      <InstructionsSection shell={shell} owner={project.id} back={back} />

      <div className="danger-zone">
        <button className="btn small danger" onClick={remove}>Delete this game</button>
      </div>
    </div>
  );
}
