import { useCallback, useEffect, useState } from 'react';
import { APP_OWNER, type Session } from '../../../shared/types';
import { api } from '../api';
import type { Shell } from '../App';
import { SessionList } from '../components/SessionList';

export function AppPage({ shell, onHelp }: { shell: Shell; onHelp: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const auth = shell.health?.auth ?? null;

  const refresh = useCallback(async () => {
    try { setSessions(await api.listSessions(APP_OWNER)); } catch (e) { shell.report(e); }
  }, [shell]);
  useEffect(() => { void refresh(); }, [refresh]);

  const disconnect = async () => {
    if (!confirm('Disconnect Claude? You will need to connect again before the AI can work.')) return;
    try { await api.logout(); await shell.refreshHealth(); } catch (e) { shell.report(e); }
  };

  return (
    <div className="page">
      <header className="page-head accent-app">
        <h1>⚙ The app</h1>
        <p className="lead">Two things live here: the connection to Claude, and a way to change the app itself just by asking.</p>
      </header>

      <h3>Claude connection</h3>
      <div className="card row">
        <span className={`dot ${auth?.connected ? 'ok' : 'bad'}`}>●</span>
        <span className="grow">
          {auth === null ? 'Checking…' : auth.connected ? <>Connected{auth.detail ? <span className="muted"> · {auth.detail}</span> : null}</> : 'Not connected — the AI cannot work yet.'}
        </span>
        <button className="btn small" onClick={shell.openSetup}>{auth?.connected ? 'Reconnect' : 'Connect'}</button>
        {auth?.connected && <button className="btn small ghost" onClick={disconnect}>Disconnect</button>}
      </div>

      <h3>Change the app</h3>
      <button className="big-btn accent-app" onClick={() => shell.openSession(APP_OWNER, 'app')}>
        <span className="big-plus">＋</span>
        <span>
          <span className="big-title">Ask for a change in the app</span>
          <span className="big-sub">“Make the text bigger”, “add a button that…”, “I'd like a dark mode” — the AI edits the app and it updates live.</span>
        </span>
      </button>

      {sessions.length > 0 && (
        <>
          <h3>Past changes</h3>
          <SessionList
            sessions={sessions}
            emptyText=""
            onOpen={(s) => shell.go({ type: 'session', owner: APP_OWNER, id: s.id })}
            onDelete={(s) => api.deleteSession(APP_OWNER, s.id).then(refresh).catch(shell.report)}
          />
        </>
      )}

      <details className="advanced">
        <summary>For whoever helps with the technical side</summary>
        <div className="card">
          <p><b>App folder:</b> <code>{shell.health?.appDir}</code></p>
          <p><b>Your data (instructions, games, sessions):</b> <code>{shell.health?.workspaceDir}</code></p>
          <p>The app runs locally with hot reload (<code>npm start</code>). <button className="btn small ghost" onClick={onHelp}>Read the full guide</button></p>
        </div>
      </details>
    </div>
  );
}
