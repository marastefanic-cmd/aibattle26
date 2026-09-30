import { useState } from 'react';
import type { HealthInfo, Project } from '../../../shared/types';
import type { View } from '../App';

interface Props {
  projects: Project[];
  view: View;
  health: HealthInfo | null;
  onGo: (v: View) => void;
  onNewGame: (name: string) => void;
  onHelp: () => void;
}

export function Nav({ projects, view, health, onGo, onNewGame, onHelp }: Props) {
  const [newGame, setNewGame] = useState<string | null>(null);
  const activeGame = view.type === 'game' ? view.id : view.type === 'session' && !view.owner.startsWith('_') ? view.owner : null;
  const activeTop = view.type === 'session' ? (view.owner === '_global' ? 'instructions' : view.owner === '_app' ? 'app' : null) : view.type;
  const agent = health?.agents.find((a) => a.kind === health.settings.agent);

  return (
    <aside className="nav">
      <div className="brand">
        <div>Rulebook <span>Studio</span></div>
        <button className="icon-btn" title="How this app works" onClick={onHelp}>?</button>
      </div>

      <button className={`nav-item accent-instructions${activeTop === 'instructions' ? ' active' : ''}`} onClick={() => onGo({ type: 'instructions' })}>
        <span className="nav-icon">★</span>
        <span>
          <span className="nav-title">Persistent instructions</span>
          <span className="nav-sub">apply to every game</span>
        </span>
      </button>

      <div className="section-title">
        My games
        <button className="icon-btn" title="Add a game" onClick={() => setNewGame('')}>＋</button>
      </div>
      {newGame !== null && (
        <form
          className="inline-form"
          onSubmit={(e) => { e.preventDefault(); if (newGame.trim()) { onNewGame(newGame.trim()); setNewGame(null); } }}
        >
          <input
            className="text" autoFocus placeholder="Name of the game…" value={newGame}
            onChange={(e) => setNewGame(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setNewGame(null); }}
          />
          <button className="btn primary small" type="submit">Add</button>
        </form>
      )}
      <div className="games">
        {projects.map((p) => (
          <button key={p.id} className={`nav-item game${p.id === activeGame ? ' active' : ''}`} onClick={() => onGo({ type: 'game', id: p.id })}>
            <span className="nav-icon">🎲</span>
            <span className="nav-title ellipsis">{p.name}</span>
          </button>
        ))}
        {!projects.length && (
          <div className="nav-hint">No games yet. Click ＋ to add the game you are working on.</div>
        )}
      </div>

      <button className={`nav-item accent-app${activeTop === 'app' ? ' active' : ''}`} onClick={() => onGo({ type: 'app' })}>
        <span className="nav-icon">⚙</span>
        <span>
          <span className="nav-title">The app</span>
          <span className="nav-sub">assistant · change the app</span>
        </span>
      </button>

      <div className="nav-footer">
        <span className={`dot ${agent?.available && health?.terminalHost ? 'ok' : 'bad'}`}>●</span>
        {health === null
          ? <span className="grow muted">Connecting…</span>
          : !health.terminalHost
            ? <span className="grow">Terminal host down — restart the app</span>
            : agent?.available
              ? <span className="grow ellipsis" title={agent.path}>{agent.label} ready</span>
              : <button className="btn small primary grow" onClick={() => onGo({ type: 'app' })}>Choose an assistant</button>}
      </div>
    </aside>
  );
}
