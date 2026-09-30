import type { Session } from '../../../shared/types';

interface Props {
  sessions: Session[];
  emptyText: string;
  onOpen: (s: Session) => void;
  onDelete: (s: Session) => void;
}

export function SessionList({ sessions, emptyText, onOpen, onDelete }: Props) {
  if (!sessions.length) return <div className="muted file-empty">{emptyText}</div>;
  return (
    <div className="session-list">
      {sessions.map((s) => (
        <div key={s.id} className="session-row">
          <button className="session-title" onClick={() => onOpen(s)}>{s.title}</button>
          <span className="muted tiny">{new Date(s.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          <button className="icon-btn" title="Delete this session" onClick={() => { if (confirm(`Delete "${s.title}"?`)) onDelete(s); }}>✕</button>
        </div>
      ))}
    </div>
  );
}
