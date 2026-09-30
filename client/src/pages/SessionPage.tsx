import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_OWNER, GLOBAL_OWNER, type ChatMessage, type PermissionRequest, type ServerEvent, type Session } from '../../../shared/types';
import { api } from '../api';
import type { Shell, View } from '../App';
import { MessageView } from '../components/MessageView';

interface Props {
  shell: Shell;
  owner: string;
  sessionId: string;
}

const EFFORTS: Session['effort'][] = ['low', 'medium', 'high', 'xhigh', 'max'];

export function SessionPage({ shell, owner, sessionId }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<PermissionRequest[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [title, setTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const game = owner.startsWith('_') ? null : shell.projects.find((p) => p.id === owner) ?? null;
  const backView: View = owner === GLOBAL_OWNER ? { type: 'instructions' } : owner === APP_OWNER ? { type: 'app' } : { type: 'game', id: owner };
  const kind = session?.kind ?? (owner === APP_OWNER ? 'app' : owner === GLOBAL_OWNER ? 'instructions' : 'work');

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
        setRunning(false); setPending([]); setStatus(null);
        break;
      case 'permission_request': setPending((prev) => [...prev, ev.request]); break;
      case 'permission_resolved': setPending((prev) => prev.filter((r) => r.id !== ev.requestId)); break;
      case 'session': setSession(ev.session); setTitle(ev.session.title); break;
      case 'status': setStatus(ev.text); break;
      case 'error': shell.report(new Error(ev.text)); break;
    }
  }, [shell]);

  useEffect(() => {
    let cancelled = false;
    const load = () => api.getSession(owner, sessionId).then((r) => {
      if (cancelled) return;
      setSession(r.session); setTitle(r.session.title);
      setMessages(r.messages); setRunning(r.running); setPending(r.pending);
    }).catch(shell.report);
    void load();
    const es = new EventSource(api.eventsUrl(owner, sessionId));
    es.onmessage = (e) => applyEvent(JSON.parse(e.data) as ServerEvent);
    // The server restarts itself after code changes; when the stream reconnects, resync.
    let first = true;
    es.onopen = () => { if (first) { first = false; return; } void load(); };
    return () => { cancelled = true; es.close(); };
  }, [owner, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setInput(''); setRunning(true); stickToBottom.current = true;
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    try { await api.sendMessage(owner, sessionId, text); }
    catch (e) { setRunning(false); setInput(text); shell.report(e); }
  };

  const abort = () => api.abort(owner, sessionId).catch(shell.report);
  const resolve = (rid: string, allow: boolean) => {
    setPending((prev) => prev.filter((r) => r.id !== rid));
    api.resolvePermission(owner, sessionId, rid, allow).catch(shell.report);
  };
  const patch = (data: Partial<Session>) => api.updateSession(owner, sessionId, data).then(setSession).catch(shell.report);

  const autoGrow = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  };

  const subtitle = kind === 'app' ? 'Changing the app'
    : kind === 'instructions' ? (game ? `Changing the instructions for ${game.name}` : 'Changing the persistent instructions')
      : game ? `Session in ${game.name}` : 'Session';
  const placeholder = messages.length ? 'Reply…'
    : kind === 'app' ? 'Describe what you would like changed in the app…'
      : kind === 'instructions' ? 'Describe the rule, e.g. “Always use Czech quotation marks and never bold whole sentences.”'
        : 'Tell the AI what to do, e.g. “Check the translation for terminology consistency against the glossary.”';
  const intro = kind === 'app'
    ? <>Say what you want different — bigger text, a new button, a different colour, anything. The AI changes the app and it updates on its own. You'll be asked before it runs anything unusual.</>
    : kind === 'instructions'
      ? <>Describe the rule or change in your own words. The AI writes it into the instruction files and tells you what it changed. Future sessions will follow it.</>
      : <>The AI already knows the persistent instructions and this game's files. Give it one task per session — a spellcheck, a terminology check, a comparison with the original…</>;

  return (
    <div className="session">
      <div className="topbar">
        <button className="btn small ghost" onClick={() => shell.go(backView)}>← Back</button>
        <div className="grow" style={{ minWidth: 0 }}>
          <input
            className="title-input" value={title} placeholder="Session"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (session && title.trim() && title !== session.title) void patch({ title: title.trim() }); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <div className="tiny muted" style={{ paddingLeft: 6 }}>{subtitle}</div>
        </div>
        {session?.totalCostUsd ? <span className="tiny muted" title="Estimated cost so far">${session.totalCostUsd.toFixed(2)}</span> : null}
        <button className="icon-btn" title="Settings" onClick={() => setShowSettings((s) => !s)}>⚙</button>
      </div>
      {showSettings && session && (
        <div className="settings-bar row">
          <label className="tiny muted">Model
            <select className="text" value={session.model} onChange={(e) => void patch({ model: e.target.value })}>
              {(shell.health?.models ?? [session.model]).map((m) => <option key={m} value={m}>{m.replace('claude-', '')}</option>)}
            </select>
          </label>
          <label className="tiny muted">Effort
            <select className="text" value={session.effort} onChange={(e) => void patch({ effort: e.target.value as Session['effort'] })}>
              {EFFORTS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <span className="tiny muted">Usually there is no need to change these.</span>
        </div>
      )}

      <div className="chat" ref={scrollRef} onScroll={onScroll}>
        <div className="chat-inner">
          {!messages.length && <div className="intro">{intro}</div>}
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
            ref={textareaRef} className="text" placeholder={placeholder} value={input} rows={1}
            onChange={(e) => { setInput(e.target.value); autoGrow(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          />
          {running
            ? <button className="btn danger" onClick={abort}>Stop</button>
            : <button className="btn primary" onClick={send} disabled={!input.trim()}>Send</button>}
        </div>
        <div className="hint"><span>Enter to send · Shift+Enter for a new line</span></div>
      </div>
    </div>
  );
}

function PermissionCard({ request, onResolve }: { request: PermissionRequest; onResolve: (id: string, allow: boolean) => void }) {
  const input = request.input;
  const isBash = request.toolName === 'Bash' && typeof input.command === 'string';
  const what = isBash ? 'run this command on your computer'
    : /^(Write|Edit|MultiEdit)$/.test(request.toolName) ? `change the file ${String(input.file_path ?? '')}`
      : request.toolName === 'WebFetch' || request.toolName === 'WebSearch' ? 'look something up on the internet'
        : `use “${request.toolName}”`;
  return (
    <div className="permission">
      <div className="head">The AI asks for permission to {what}.</div>
      {typeof input.description === 'string' && <div className="muted">{input.description}</div>}
      <pre>{isBash ? String(input.command) : JSON.stringify(input, null, 2)}</pre>
      <div className="row">
        <button className="btn primary" onClick={() => onResolve(request.id, true)}>Allow</button>
        <button className="btn" onClick={() => onResolve(request.id, false)}>Don't allow</button>
        <span className="tiny muted">Not sure? “Don't allow” is always safe — the AI will explain what it wanted.</span>
      </div>
    </div>
  );
}
