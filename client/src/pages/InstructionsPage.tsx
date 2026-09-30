import { GLOBAL_OWNER } from '../../../shared/types';
import type { Shell } from '../App';
import { InstructionsSection } from '../components/InstructionsSection';

export function InstructionsPage({ shell }: { shell: Shell }) {
  return (
    <div className="page">
      <header className="page-head accent-instructions">
        <h1>★ Persistent instructions</h1>
        <p className="lead">
          These are the standing rules the AI reads <b>before every session, in every game</b>: how you want translations reviewed,
          your style conventions, what a finished report should look like. You never have to edit the files yourself — just tell the AI what should change.
        </p>
      </header>
      <InstructionsSection shell={shell} owner={GLOBAL_OWNER} back={{ type: 'instructions' }} />
    </div>
  );
}
