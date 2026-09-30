import { useState } from 'react';
import type { AuthStatus } from '../../../shared/types';
import { api } from '../api';

interface Props {
  auth: AuthStatus | null;
  onDone: () => void;
  onSkip: () => void;
}

type Step = 'choose' | 'login' | 'apikey' | 'done';

export function SetupWizard({ auth, onDone, onSkip }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [url, setUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuthStatus | null>(auth?.connected ? auth : null);

  const startLogin = async (mode: 'claudeai' | 'console') => {
    setBusy(true); setError(null);
    try {
      const r = await api.loginStart(mode);
      setUrl(r.url);
      setStep('login');
      window.open(r.url, '_blank');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const finishLogin = async () => {
    if (!code.trim()) return;
    setBusy(true); setError(null);
    try { setResult(await api.loginCode(code)); setStep('done'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const saveKey = async () => {
    setBusy(true); setError(null);
    try { setResult(await api.saveApiKey(key)); setStep('done'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const cancel = () => { api.loginCancel().catch(() => undefined); setUrl(null); setCode(''); setStep('choose'); setError(null); };

  return (
    <div className="modal-backdrop">
      <div className="modal wizard">
        <div className="modal-head">
          <span>{step === 'done' ? 'Claude is connected' : 'Connect Claude'}</span>
          {step !== 'done' && <button className="btn small ghost" onClick={onSkip}>Later</button>}
        </div>
        <div className="modal-body">
          {step === 'choose' && (
            <>
              <p>This app uses <b>Claude</b> (an AI by Anthropic) to review translations. Connect it once; the app remembers it.</p>
              {auth?.connected && <p className="muted tiny">Currently connected{auth.detail ? ` (${auth.detail})` : ''}. Choose an option below only if you want to switch accounts.</p>}
              <div className="choice-grid">
                <button className="choice" disabled={busy} onClick={() => startLogin('claudeai')}>
                  <div className="choice-title">I have a Claude subscription <span className="pill">recommended</span></div>
                  <div className="muted">Claude Pro or Max. You'll sign in with your normal Claude account in the browser.</div>
                </button>
                <button className="choice" disabled={busy} onClick={() => setStep('apikey')}>
                  <div className="choice-title">I have an API key</div>
                  <div className="muted">A long code starting with “sk-ant-” from the Anthropic Console (pay-as-you-go).</div>
                </button>
                <button className="choice" disabled={busy} onClick={() => startLogin('console')}>
                  <div className="choice-title">Sign in to the Anthropic Console</div>
                  <div className="muted">Pay-as-you-go account, but without copying an API key.</div>
                </button>
              </div>
              {busy && <p className="muted"><span className="spinner" /> Starting the sign-in…</p>}
              {error && <p className="error-text">{error}</p>}
            </>
          )}

          {step === 'login' && (
            <>
              <ol className="steps">
                <li>
                  A sign-in page should have opened in your browser. If not,{' '}
                  <a href={url ?? '#'} target="_blank" rel="noreferrer">click here to open it</a>.
                </li>
                <li>Sign in with your Claude account and click <b>Authorize</b>.</li>
                <li>The page will show a <b>code</b>. Copy it and paste it here:</li>
              </ol>
              <div className="row">
                <input className="text grow" autoFocus placeholder="Paste the code…" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void finishLogin(); }} />
                <button className="btn primary" disabled={busy || !code.trim()} onClick={finishLogin}>{busy ? <span className="spinner" /> : 'Finish'}</button>
              </div>
              {error && <p className="error-text">{error}</p>}
              <p><button className="btn small ghost" onClick={cancel}>← Start over</button></p>
            </>
          )}

          {step === 'apikey' && (
            <>
              <p>Paste your API key. It is stored only on this computer.</p>
              <div className="row">
                <input className="text grow" autoFocus placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveKey(); }} />
                <button className="btn primary" disabled={busy || !key.trim()} onClick={saveKey}>Save</button>
              </div>
              {error && <p className="error-text">{error}</p>}
              <p><button className="btn small ghost" onClick={cancel}>← Back</button></p>
            </>
          )}

          {step === 'done' && (
            <>
              <p className="big-ok">✓ Connected{result?.detail ? ` (${result.detail})` : ''}.</p>
              <p>You won't need to do this again. If it ever stops working, open <b>The app</b> in the menu and connect again.</p>
              <button className="btn primary" onClick={onDone}>Start using the app</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
