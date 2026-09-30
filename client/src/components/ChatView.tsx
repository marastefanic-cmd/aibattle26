import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, PermissionRequest, Project, ServerEvent, Session } from '../../../shared/types';
import { api } from '../api';
import { MessageView } from './MessageView';

interface Props {
  project: Project;
  session: Session;
  models: string[];
  onSessionChange: (s: Session) => void;
  onError: (e: unknown) => void;
  onFilesChanged: () => void;
}

const EFFORTS: Session['effort'][] = ['low', 'medium', 'high', 'xhigh', 'max'];

export function ChatView({ project, session, models, onSessionChange, onError, onFilesChanged }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<PermissionRequest[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [title, setTitle] = useState(session.title);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setTitle(session.title), [session.title]);

  const applyEvent = useCallback((ev: ServerEvent) => {
    switch (ev.type) {
      case 'message':
        setMessages((prev) => {
          const i = prev.findIndex((m) => m.id === ev.message.id);
          if (i === -1) return [...prev, ev.message];
          const next = prev.slice();
          next[i] = ev.message;
          return next;
        });
        if (ev.message.role === 'assistant' && ev.message.streaming) setRunning(true);
        break;
      case 'text_delta':
      case 'thinking_delta':
        setMessages((prev) => prev.map((m) => {
          if (m.id !== ev.messageId) return m;
          const blocks = m.blocks.slice();
          const last = blocks[blocks.length - 1];
          const want = ev.type === 'text_delta' ? 'text' : 'thinking';
          if (last && last.type === want) blocks[blocks.length - 1] = { ...last, text: last.text + ev.text };
          else blocks.push({ type: want, text: ev.text });
          return { ...m, blocks };
        }));
        break;
      case 'turn_end':
        setRunning(false);
        setPending([]);
        setStatus(null);
        onFilesChanged();
        break;
      case 'permission_request':
        setPending((prev) => [...prev, ev.request]);
        break;
      case 'permission_resolved':
        setPending((prev) => prev.filter((r) => r.id !== ev.requestId));
        break;
      case 'session':
        onSessionChange(ev.session);
        break;
      case 'status':
        setStatus(ev.text);
        break;
      case 'error':
        onError(new Error(ev.text));
        break;
    }
  }, [onSessionChange, onError, onFilesChanged]);

  // Load transcript and subscribe to live events.
  useEffect(() => {
    let cancelled = false;
    api.getSession(project.id, session.id).then((r) => {
      if (cancelled) return;
      setMessages(r.messages);
      setRunning(r.running);
      setPending(r.pending);
    }).catch(onError);
    const es = new EventSource(api.eventsUrl(project.id, session.id));
    es.onmessage = (e) => applyEvent(JSON.parse(e.data) as ServerEvent);
    return () => { cancelled = true; es.close(); };
  }, [project.id, session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll while the user is near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || running) return;
    setInput('');
    setRunning(true);
    stickToBottom.current = true;
    try { await api.sendMessage(project.id, session.id, text); }
    catch (e) { setRunning(false); setInput(text); onError(e); }
  };

  const abort = () => api.abort(project.id, session.id).catch(onError);

  const resolve = (rid: string, allow: boolean) => {
    setPending((prev) => prev.filter((r) => r.id !== rid));
    api.resolvePermission(project.id, session.id, rid, allow).catch(onError);
  };

  const patch = (patchData: Partial<Session>) =>
    api.updateSession(project.id, session.id, patchData).then(onSessionChange).catch(onError);

  const autoGrow = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  };

  const hasTurns = messages.length > 0;

  return (
    <>
      <div className="topbar">
        <input
          className="title-input" value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() && title !== session.title) void patch({ title: title.trim() }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
        <select value={session.model} onChange={(e) => void patch({ model: e.target.value })} title="Model">
          {(models.length ? models : [session.model]).map((m) => <option key={m} value={m}>{m.replace('claude-', '')}</option>)}
        </select>
        <select value={session.effort} onChange={(e) => void patch({ effort: e.target.value as Session['effort'] })} title="Effort (thinking depth)">
          {EFFORTS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="tiny muted" title="Estimated cost of this session so far">{session.totalCostUsd ? `$${session.totalCostUsd.toFixed(2)}` : ''}</span>
      </div>

      <div className="chat" ref={scrollRef} onScroll={onScroll}>
        <div className="chat-inner">
          {!hasTurns && (
            <div className="empty" style={{ height: 'auto', padding: '60px 20px' }}>
              <div>
                <h2>Fresh session</h2>
                The agent already has the global docs and this project's context (see the panel on the right).<br />
                Just say what this session should do, e.g. <em>"Check the translation for terminology consistency against the glossary."</em>
              </div>
            </div>
          )}
          {messages.map((m) => <MessageView key={m.id} message={m} />)}
          {pending.map((r) => <PermissionCard key={r.id} request={r} onResolve={resolve} />)}
          {running && !pending.length && (
            <div className="msg system"><div className="bubble"><span className="spinner" /> {status ?? 'Working…'}</div></div>
          )}
        </div>
      </div>

      <div className="composer">
        <div className="composer-inner">
          <textarea
            ref={textareaRef}
            className="text"
            placeholder={hasTurns ? 'Reply…' : 'What should this session do?'}
            value={input}
            rows={1}
            onChange={(e) => { setInput(e.target.value); autoGrow(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          />
          {running
            ? <button className="btn danger" onClick={abort}>Stop</button>
            : <button className="btn primary" onClick={send} disabled={!input.trim()}>Send</button>}
        </div>
        <div className="hint">
          <span>Enter to send · Shift+Enter for a new line</span>
          <span>{session.sdkSessionId ? 'conversation continues across turns' : ''}</span>
        </div>
      </div>
    </>
  );
}

function PermissionCard({ request, onResolve }: { request: PermissionRequest; onResolve: (id: string, allow: boolean) => void }) {
  const input = request.input;
  const detail = request.toolName === 'Bash' && typeof input.command === 'string'
    ? input.command
    : JSON.stringify(input, null, 2);
  return (
    <div className="permission">
      <div className="head">The agent wants to run <code>{request.toolName}</code></div>
      {typeof input.description === 'string' && <div className="muted">{input.description}</div>}
      <pre>{detail}</pre>
      <div className="row">
        <button className="btn primary" onClick={() => onResolve(request.id, true)}>Allow</button>
        <button className="btn" onClick={() => onResolve(request.id, false)}>Deny</button>
      </div>
    </div>
  );
}
