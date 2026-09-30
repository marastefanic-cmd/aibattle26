import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  /** WebSocket URL of the terminal host for this session. */
  url: string;
  /** Called when the assistant process ends. */
  onExit?: (code: number | null) => void;
  /** Called when the terminal was attached (first time and after reconnects). */
  onAttached?: (alive: boolean) => void;
}

type Frame =
  | { type: 'scrollback'; data: string; alive: boolean; exitCode: number | null }
  | { type: 'data'; data: string }
  | { type: 'exit'; code: number | null }
  | { type: 'missing' };

/** An xterm.js view attached to one terminal in the terminal host. Reconnects on its own. */
export function Terminal({ url, onExit, onAttached }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onExit, onAttached });
  callbacks.current = { onExit, onAttached };

  useEffect(() => {
    const el = hostRef.current!;
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace',
      scrollback: 5000,
      allowProposedApi: true,
      theme: { background: '#1e1d1b', foreground: '#eae7e0', cursor: '#f0c9be', selectionBackground: '#5a4a44' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const sendResize = () => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(url);
      ws.onopen = () => { retry = 0; sendResize(); };
      ws.onmessage = (e) => {
        const frame = JSON.parse(e.data) as Frame;
        switch (frame.type) {
          case 'scrollback':
            term.reset();
            term.write(frame.data);
            callbacks.current.onAttached?.(frame.alive);
            if (!frame.alive) callbacks.current.onExit?.(frame.exitCode);
            break;
          case 'data': term.write(frame.data); break;
          case 'exit': callbacks.current.onExit?.(frame.code); break;
          case 'missing': callbacks.current.onAttached?.(false); break;
        }
      };
      ws.onclose = () => {
        ws = null;
        if (closed) return;
        retryTimer = setTimeout(connect, Math.min(5000, 500 * 2 ** retry++));
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    const inputSub = term.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
    });
    const resizeObs = new ResizeObserver(() => { fit.fit(); sendResize(); });
    resizeObs.observe(el);
    term.focus();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      inputSub.dispose();
      resizeObs.disconnect();
      ws?.close();
      term.dispose();
    };
  }, [url]);

  return <div className="terminal" ref={hostRef} />;
}
