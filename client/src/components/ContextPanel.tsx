import { useMemo, useRef, useState } from 'react';
import {
  type ContextFile, type ContextSelection, type FileMode, type Project, type Scope, type Session,
  PREAMBLE_TOKENS, effectiveMode, fileKey,
} from '../../../shared/types';
import { api } from '../api';
import type { OpenFile } from '../App';

interface Props {
  project: Project;
  session: Session | null;
  globalFiles: ContextFile[];
  projectFiles: ContextFile[];
  onOpenFile: (f: OpenFile) => void;
  onRefresh: () => void;
  onSessionChange: (s: Session) => void;
  onProjectChange: (p: Project) => void;
  onError: (e: unknown) => void;
}

const PROJECT_FOLDERS = ['context', 'context/original', 'context/translation', 'output'];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ContextPanel(p: Props) {
  const { project, session } = p;
  const editingSession = session !== null;
  const [preview, setPreview] = useState<{ systemPrompt: string; tokens: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const modeOf = (f: ContextFile): FileMode =>
    editingSession ? effectiveMode(f, session.context, project.defaults) : effectiveMode(f, project.defaults);

  const allFiles = useMemo(() => [...p.globalFiles, ...p.projectFiles], [p.globalFiles, p.projectFiles]);
  const totalTokens = PREAMBLE_TOKENS + allFiles.reduce((sum, f) => sum + (modeOf(f) === 'inline' && f.kind === 'text' ? f.tokens : 0), 0);

  const setMode = async (f: ContextFile, mode: FileMode) => {
    const key = fileKey(f.scope, f.path);
    try {
      if (editingSession) {
        const context: ContextSelection = { ...session.context, [key]: mode };
        p.onSessionChange(await api.updateSession(project.id, session.id, { context }));
      } else {
        const defaults: ContextSelection = { ...project.defaults, [key]: mode };
        p.onProjectChange(await api.updateProject(project.id, { defaults }));
      }
    } catch (e) { p.onError(e); }
  };

  const saveAsDefaults = async () => {
    if (!session) return;
    try {
      const defaults: ContextSelection = {};
      for (const f of allFiles) defaults[fileKey(f.scope, f.path)] = modeOf(f);
      p.onProjectChange(await api.updateProject(project.id, { defaults }));
    } catch (e) { p.onError(e); }
  };

  const resetToDefaults = async () => {
    if (!session) return;
    try { p.onSessionChange(await api.updateSession(project.id, session.id, { context: {} })); } catch (e) { p.onError(e); }
  };

  const showPreview = async () => {
    if (!session) return;
    try { setPreview(await api.contextPreview(project.id, session.id)); } catch (e) { p.onError(e); }
  };

  const upload = async (scope: Scope, files: FileList | File[], dir: string) => {
    if (!files.length) return;
    setBusy(true);
    try { await api.upload(scope, files, dir, scope === 'project' ? project.id : undefined); p.onRefresh(); }
    catch (e) { p.onError(e); } finally { setBusy(false); }
  };

  const newFile = async (scope: Scope, dir: string) => {
    const name = prompt(`New file name${dir ? ` in ${dir}/` : ''} (e.g. notes.md):`);
    if (!name) return;
    const path = dir ? `${dir}/${name}` : name;
    try {
      await api.writeFile(scope, path, '', scope === 'project' ? project.id : undefined);
      p.onRefresh();
      p.onOpenFile({ scope, path });
    } catch (e) { p.onError(e); }
  };

  const deleteFile = async (f: ContextFile) => {
    if (!confirm(`Delete ${f.path}?`)) return;
    try { await api.deleteFile(f.scope, f.path, f.scope === 'project' ? project.id : undefined); p.onRefresh(); }
    catch (e) { p.onError(e); }
  };

  const renameFile = async (f: ContextFile) => {
    const to = prompt('New path:', f.path);
    if (!to || to === f.path) return;
    try { await api.renameFile(f.scope, f.path, to, f.scope === 'project' ? project.id : undefined); p.onRefresh(); }
    catch (e) { p.onError(e); }
  };

  return (
    <aside className="context">
      <div className="head">
        <div>
          <h3>Context</h3>
          <div className="tiny muted">{editingSession ? 'this session' : `defaults for ${project.name}`}</div>
        </div>
        {editingSession && (
          <div className="row">
            <button className="btn small" title="Make this session's selection the default for new sessions in this project" onClick={saveAsDefaults}>Save as default</button>
            <button className="btn small ghost" title="Drop this session's overrides" onClick={resetToDefaults}>Reset</button>
          </div>
        )}
      </div>

      <div className="scroll">
        <FileGroup
          title="Global · every project" scope="global" files={p.globalFiles} folders={['']}
          modeOf={modeOf} onMode={setMode} onOpen={p.onOpenFile} onDelete={deleteFile} onRename={renameFile}
          onUpload={upload} onNew={newFile} busy={busy} projectId={undefined}
          hint="Instructions, methodology, example finished files. Applies to all projects."
        />
        <FileGroup
          title={`Project · ${project.name}`} scope="project" files={p.projectFiles} folders={PROJECT_FOLDERS}
          modeOf={modeOf} onMode={setMode} onOpen={p.onOpenFile} onDelete={deleteFile} onRename={renameFile}
          onUpload={upload} onNew={newFile} busy={busy} projectId={project.id}
          hint="Original rules, translation, glossary, changelog, buglist. The agent writes deliverables to output/."
        />
        <div className="legend">
          <b>Inline</b> = full text goes into the prompt at session start. <b>Ref</b> = only the path is listed; the agent reads it when needed (PDFs, big files). <b>Off</b> = not mentioned.
        </div>
      </div>

      <div className="foot">
        <span className={`tokens${totalTokens > 150_000 ? ' warn' : ''}`} title="Estimated prompt size at session start">
          ~{totalTokens.toLocaleString()} tokens preloaded
        </span>
        {editingSession && <button className="btn small ghost" onClick={showPreview}>Preview prompt</button>}
      </div>

      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>System prompt the agent receives (~{preview.tokens.toLocaleString()} tokens)</span>
              <button className="icon-btn" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div className="modal-body"><pre>{preview.systemPrompt}</pre></div>
          </div>
        </div>
      )}
    </aside>
  );
}

interface GroupProps {
  title: string;
  hint: string;
  scope: Scope;
  files: ContextFile[];
  folders: string[];
  projectId?: string;
  busy: boolean;
  modeOf: (f: ContextFile) => FileMode;
  onMode: (f: ContextFile, m: FileMode) => void;
  onOpen: (f: OpenFile) => void;
  onDelete: (f: ContextFile) => void;
  onRename: (f: ContextFile) => void;
  onUpload: (scope: Scope, files: FileList | File[], dir: string) => void;
  onNew: (scope: Scope, dir: string) => void;
}

function FileGroup(g: GroupProps) {
  const [dir, setDir] = useState(g.folders[0]);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="group">
      <div className="group-head">
        <h4>{g.title}</h4>
        <div className="row">
          {g.folders.length > 1 && (
            <select className="text" style={{ width: 'auto', padding: '1px 4px', fontSize: 11 }} value={dir} onChange={(e) => setDir(e.target.value)} title="Folder for uploads and new files">
              {g.folders.map((f) => <option key={f} value={f}>{f}/</option>)}
            </select>
          )}
          <button className="btn small ghost" onClick={() => g.onNew(g.scope, dir)} title="Create a new text file">＋ File</button>
          <button className="btn small ghost" onClick={() => inputRef.current?.click()} disabled={g.busy} title="Upload files">⇧ Upload</button>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) g.onUpload(g.scope, e.target.files, dir); e.target.value = ''; }} />
        </div>
      </div>
      {!g.files.length && <div className="legend">{g.hint}</div>}
      {g.files.map((f) => {
        const mode = g.modeOf(f);
        const isText = f.kind === 'text';
        return (
          <div key={f.path} className={`file-row${mode === 'off' ? ' off' : ''}`}>
            <span
              className="name" title={isText ? 'Edit' : 'Download'}
              onClick={() => (isText ? g.onOpen({ scope: g.scope, path: f.path }) : window.open(api.fileUrl(g.scope, f.path, g.projectId), '_blank'))}
            >
              {f.path}
            </span>
            <div className="seg">
              {(['inline', 'reference', 'off'] as FileMode[]).map((m) => (
                <button
                  key={m}
                  className={mode === m ? `on ${m}` : ''}
                  disabled={m === 'inline' && !isText}
                  title={m === 'inline' && !isText ? 'Binary files cannot be inlined' : undefined}
                  onClick={() => g.onMode(f, m)}
                >
                  {m === 'inline' ? 'Inline' : m === 'reference' ? 'Ref' : 'Off'}
                </button>
              ))}
            </div>
            <div className="meta">
              <span>{fmtSize(f.size)}{isText ? ` · ~${f.tokens.toLocaleString()} tok` : ''}</span>
              <span className="grow" />
              <button className="icon-btn" title="Rename / move" onClick={() => g.onRename(f)}>✎</button>
              <button className="icon-btn" title="Delete" onClick={() => g.onDelete(f)}>✕</button>
            </div>
          </div>
        );
      })}
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); g.onUpload(g.scope, e.dataTransfer.files, dir); }}
      >
        {g.busy ? <span className="spinner" /> : <>Drop files here → {dir ? `${dir}/` : 'global/'}</>}
      </div>
    </div>
  );
}
