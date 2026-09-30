import { useCallback, useEffect, useState } from 'react';
import type { ContextFile, Session } from '../../../shared/types';
import { api } from '../api';
import type { Shell, View } from '../App';
import { FileRows } from './FileRows';
import { SessionList } from './SessionList';

interface Props {
  shell: Shell;
  /** GLOBAL_OWNER for the general instructions, or a project id for game-specific ones. */
  owner: string;
  back: View;
}

/**
 * The "persistent instructions" block: a big prompt button, the current files,
 * and past instruction-change sessions. Used for the global page and inside each game.
 */
export function InstructionsSection({ shell, owner, back }: Props) {
  const isGlobal = owner === '_global';
  const scope = isGlobal ? 'global' : 'project';
  const projectId = isGlobal ? undefined : owner;
  const prefix = isGlobal ? '' : 'instructions/';
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const refresh = useCallback(async () => {
    try {
      const all = await api.listFiles(scope, projectId);
      setFiles(isGlobal ? all : all.filter((f) => f.path.startsWith(prefix)));
      setSessions((await api.listSessions(owner)).filter((s) => s.kind === 'instructions'));
    } catch (e) { shell.report(e); }
  }, [scope, projectId, isGlobal, prefix, owner, shell]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <>
      <button className="big-btn accent-instructions" onClick={() => shell.openSession(owner, 'instructions')}>
        <span className="big-plus">＋</span>
        <span>
          <span className="big-title">Tell the AI what to change</span>
          <span className="big-sub">Describe a rule in your own words — the AI writes it into the instructions for you.</span>
        </span>
      </button>

      <h3>Current instruction files</h3>
      <FileRows
        scope={scope} projectId={projectId} files={files} dir={isGlobal ? '' : 'instructions'} hidePrefix={prefix}
        emptyText={isGlobal ? 'No instructions yet.' : 'No game-specific instructions yet. The general ones still apply.'}
        uploadLabel="Add a document"
        onChanged={refresh}
        onOpen={(f) => shell.go({ type: 'file', scope, path: f.path, projectId, back })}
        onError={shell.report}
      />

      {sessions.length > 0 && (
        <>
          <h3>Past changes</h3>
          <SessionList
            sessions={sessions}
            emptyText=""
            onOpen={(s) => shell.go({ type: 'session', owner, id: s.id })}
            onDelete={(s) => api.deleteSession(owner, s.id).then(refresh).catch(shell.report)}
          />
        </>
      )}
    </>
  );
}
