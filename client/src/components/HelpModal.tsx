import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('Loading…');
  useEffect(() => { api.appGuide().then((r) => setText(r.text)).catch((e) => setText(String(e))); }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>How Rulebook Studio works</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
