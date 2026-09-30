import { useCallback, useEffect, useState } from 'react';
import { APP_OWNER, GLOBAL_OWNER, type Session, type SessionStatus } from '../../../shared/types';
import { api } from '../api';
import type { Shell, View } from '../App';
import { Terminal } from '../components/Terminal';

interface Props {
  shell: Shell;
  owner: string;
  sessionId: string;
}

export function SessionPage({ shell, owner, sessionId }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [title, setTitle] = useState('');
  const [launching, setLaunching] = useState(false);
  const [showContext, setShowContext] = useState<string | null>(null);

  const game = owner.startsWith('_') ? null : shell.projects.find((p) => p.id === owner) ?? null;
  const backView: View = owner === GLOBAL_OWNER ? { type: 'instructions' } : owner === APP_OWNER ? { type: 'app' } : { type: 'game', id: owner };
  const agentLabel = shell.health?.agents.find((a) => a.kind === (session?.agent ?? shell.health?.settings.agent))?.label ?? 'the assistant';

  const launch = useCallback(async (opts: { restart?: boolean; fresh?: boolean } = {}) => {
    setLaunching(true);
    try {
      const r = await api.launchSession(owner, sessionId, opts);
      setSession(r.session); setTitle(r.session.title); setStatus(r.status);
    } catch (e) { shell.report(e); }
    finally { setLaunching(false); }
  }, [owner, sessionId, shell]);

  // Load the session and make sure the assistant is running.
  useEffect(() => {
    let cancelled = false;
    api.getSession(owner, sessionId).then(async (r) => {
      if (cancelled) return;
      setSession(r.session); setTitle(r.session.title); setStatus(r.status);
      if (!r.status.alive) await launch();
    }).catch(shell.report);
    return () => { cancelled = true; };
  }, [owner, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (data: Partial<Session>) => api.updateSession(owner, sessionId, data).then(setSession).catch(shell.report);

  const kind = session?.kind ?? (owner === APP_OWNER ? 'app' : owner === GLOBAL_OWNER ? 'instructions' : 'work');
  const subtitle = kind === 'app' ? 'Changing the app'
    : kind === 'instructions' ? (game ? `Changing the instructions for ${game.name}` : 'Changing the persistent instructions')
      : game ? `Session in ${game.name}` : 'Session';
  const hint = kind === 'app'
    ? 'Describe what you want different in the app. The assistant changes it and it updates on its own.'
    : kind === 'instructions'
      ? 'Describe the rule in your own words. The assistant writes it into the instructions and tells you what changed.'
      : 'The assistant already knows the persistent instructions and this game\'s files. Tell it what to check.';

  const ended = status !== null && status.launched && !status.alive;

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
          <div className="tiny muted" style={{ paddingLeft: 6 }}>{subtitle} · {agentLabel}</div>
        </div>
        {ended
          ? <button className="btn small primary" disabled={launching} onClick={() => launch({ restart: true })}>Start again</button>
          : <button className="btn small" disabled={launching || !status?.alive} title="Stop the assistant and start it again with the same conversation" onClick={() => launch({ restart: true })}>Restart</button>}
        <button className="btn small ghost" title="Show what the assistant was told at the start" onClick={() => api.sessionContext(owner, sessionId).then((r) => setShowContext(r.text)).catch(shell.report)}>What it knows</button>
      </div>

      <div className="hintbar">
        {hint} <span className="muted">Type in the black window and press Enter. The very first time it may ask you to pick a colour theme (just press Enter) and to sign in (choose your account type and follow the browser). Later, <code>/login</code> signs in again if needed.</span>
      </div>

      <div className="terminal-wrap">
        {session && (
          <Terminal
            key={`${session.id}:${session.launches}`}
            url={api.terminalUrl(session.id)}
            onExit={() => setStatus((s) => (s ? { ...s, alive: false } : { launched: true, alive: false }))}
            onAttached={(alive) => setStatus((s) => ({ launched: true, alive, exitCode: s?.exitCode ?? null }))}
          />
        )}
        {ended && (
          <div className="ended">
            The assistant has ended. <button className="btn small primary" disabled={launching} onClick={() => launch({ restart: true })}>Start again</button>
            {session && session.agent === 'claude' && session.launches > 1 && (
              <> <button className="btn small ghost" disabled={launching} onClick={() => launch({ restart: true, fresh: true })}>Start a fresh conversation</button></>
            )}
          </div>
        )}
      </div>

      {showContext !== null && (
        <div className="modal-backdrop" onClick={() => setShowContext(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>What the assistant was told at the start</span>
              <button className="icon-btn" onClick={() => setShowContext(null)}>✕</button>
            </div>
            <div className="modal-body"><pre>{showContext}</pre></div>
          </div>
        </div>
      )}
    </div>
  );
}
