import { useEffect, useState } from 'react';
import { api } from '../api';
import type { OpenFile } from '../App';

interface Props {
  file: OpenFile;
  projectId?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (e: unknown) => void;
}

export function FileEditor({ file, projectId, onClose, onSaved, onError }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = text !== null && text !== saved;

  useEffect(() => {
    api.readFile(file.scope, file.path, projectId)
      .then((r) => { setText(r.text); setSaved(r.text); })
      .catch(onError);
  }, [file.scope, file.path, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (text === null) return;
    setBusy(true);
    try {
      await api.writeFile(file.scope, file.path, text, projectId);
      setSaved(text);
      onSaved();
    } catch (e) { onError(e); } finally { setBusy(false); }
  };

  const close = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    onClose();
  };

  return (
    <div className="editor">
      <div className="toolbar">
        <button className="btn small" onClick={close}>← Back</button>
        <span className="path" title={file.path}>
          <span className="muted">{file.scope === 'global' ? 'global/' : 'project/'}</span>{file.path}
        </span>
        {dirty && <span className="tiny muted">unsaved</span>}
        <button className="btn primary small" disabled={!dirty || busy} onClick={save}>Save</button>
      </div>
      {text === null
        ? <div className="empty">Loading…</div>
        : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); void save(); } }}
            spellCheck={false}
          />
        )}
    </div>
  );
}
