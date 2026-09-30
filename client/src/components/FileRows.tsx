import { useRef, useState, type ReactNode } from 'react';
import type { ContextFile, Scope } from '../../../shared/types';
import { api } from '../api';

interface Props {
  scope: Scope;
  projectId?: string;
  files: ContextFile[];
  /** Folder (relative to the scope root) that uploads and new files go to. */
  dir: string;
  emptyText: string;
  uploadLabel?: string;
  /** Strip this prefix from displayed names. */
  hidePrefix?: string;
  onChanged: () => void;
  onOpen: (f: ContextFile) => void;
  onError: (e: unknown) => void;
  /** Extra controls per row (e.g. the "AI reads this" checkbox). */
  extra?: (f: ContextFile) => ReactNode;
  /** Optional picker for the upload target, rendered next to the upload button. */
  dirPicker?: ReactNode;
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileRows(p: Props) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    if (!files.length) return;
    setBusy(true);
    try { await api.upload(p.scope, files, p.dir, p.projectId); p.onChanged(); }
    catch (e) { p.onError(e); } finally { setBusy(false); }
  };

  const remove = async (f: ContextFile) => {
    if (!confirm(`Remove "${display(f.path)}"?`)) return;
    try { await api.deleteFile(p.scope, f.path, p.projectId); p.onChanged(); } catch (e) { p.onError(e); }
  };

  const display = (path: string) => (p.hidePrefix && path.startsWith(p.hidePrefix) ? path.slice(p.hidePrefix.length) : path);

  return (
    <div
      className={`filebox${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files); }}
    >
      {p.files.length === 0 && <div className="muted file-empty">{p.emptyText}</div>}
      {p.files.map((f) => (
        <div key={f.path} className="file-row">
          <span className="file-icon">{f.kind === 'text' ? '📄' : '📎'}</span>
          <button className="file-name" onClick={() => (f.kind === 'text' ? p.onOpen(f) : window.open(api.fileUrl(p.scope, f.path, p.projectId), '_blank'))} title={f.kind === 'text' ? 'Open' : 'Download'}>
            {display(f.path)}
          </button>
          <span className="muted tiny">{fmtSize(f.size)}</span>
          {p.extra?.(f)}
          <button className="icon-btn" title="Remove" onClick={() => remove(f)}>✕</button>
        </div>
      ))}
      <div className="file-actions">
        {p.dirPicker}
        <button className="btn small" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <span className="spinner" /> : `⇧ ${p.uploadLabel ?? 'Add files'}`}
        </button>
        <span className="muted tiny">or drop files here · PDF, Word, Excel, text</span>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
      </div>
    </div>
  );
}
