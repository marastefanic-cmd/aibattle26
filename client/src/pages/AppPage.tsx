import { useCallback, useEffect, useState } from 'react';
import { APP_OWNER, type AgentKind, type Session } from '../../../shared/types';
import { api } from '../api';
import type { Shell } from '../App';
import { SessionList } from '../components/SessionList';

export function AppPage({ shell, onHelp }: { shell: Shell; onHelp: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [custom, setCustom] = useState('');
  const health = shell.health;
  const settings = health?.settings;

  const refresh = useCallback(async () => {
    try { setSessions(await api.listSessions(APP_OWNER)); } catch (e) { shell.report(e); }
  }, [shell]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (settings) setCustom(settings.customCommand); }, [settings]);

  const save = async (patch: Partial<NonNullable<typeof settings>>) => {
    try { await api.updateSettings(patch); await shell.refreshHealth(); } catch (e) { shell.report(e); }
  };

  const current = health?.agents.find((a) => a.kind === settings?.agent);

  return (
    <div className="page">
      <header className="page-head accent-app">
        <h1>⚙ The app</h1>
        <p className="lead">Two things live here: which AI assistant the app opens in its sessions, and a way to change the app itself just by asking.</p>
      </header>

      <h3>AI assistant</h3>
      <div className="card">
        <p className="muted tiny" style={{ marginTop: 0 }}>Every session opens this assistant in a terminal window inside the app. Signing in happens inside the assistant itself (type <code>/login</code> when it asks) and is remembered.</p>
        {health?.agents.map((a) => (
          <label key={a.kind} className={`agent-option${settings?.agent === a.kind ? ' selected' : ''}`}>
            <input type="radio" name="agent" checked={settings?.agent === a.kind} onChange={() => save({ agent: a.kind as AgentKind })} />
            <span className="grow">
              <span className="agent-title">{a.label} {a.kind === 'claude' && <span className="pill">recommended</span>}</span>
              <span className="tiny muted">{a.available ? (a.path ? `Ready · ${a.path}` : 'Ready') : `Not found. ${a.installHint}`}</span>
            </span>
            <span className={`dot ${a.available ? 'ok' : 'bad'}`}>●</span>
          </label>
        ))}
        {settings?.agent === 'custom' && (
          <div className="row" style={{ marginTop: 8 }}>
            <input className="text grow" placeholder='e.g. gemini -i "Read {context} and follow it"' value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button className="btn small" onClick={() => save({ customCommand: custom })}>Save</button>
          </div>
        )}
        {health && !health.terminalHost && <p className="error-text">The terminal host is not running. Close the app's window and start it again.</p>}
      </div>

      <h3>Change the app</h3>
      <button className="big-btn accent-app" disabled={!current?.available} onClick={() => shell.openSession(APP_OWNER, 'app')}>
        <span className="big-plus">＋</span>
        <span>
          <span className="big-title">Ask for a change in the app</span>
          <span className="big-sub">“Make the text bigger”, “add a button that…”, “I'd like a dark mode” — the assistant edits the app and it updates live.</span>
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
          <p><b>App folder:</b> <code>{health?.appDir}</code></p>
          <p><b>Your data (instructions, games, sessions):</b> <code>{health?.workspaceDir}</code></p>
          {settings?.agent === 'claude' && (
            <p className="row"><span>Claude model (blank = default):</span>
              <input className="text" style={{ width: 160 }} defaultValue={settings.claudeModel} placeholder="opus / sonnet" onBlur={(e) => { if (e.target.value !== settings.claudeModel) void save({ claudeModel: e.target.value }); }} />
            </p>
          )}
          <p>The app runs locally with hot reload (<code>npm start</code>). <button className="btn small ghost" onClick={onHelp}>Read the full guide</button></p>
        </div>
      </details>
    </div>
  );
}
