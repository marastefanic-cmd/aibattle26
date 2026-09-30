import type { ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Block, ChatMessage } from '../../../shared/types';

/** Friendly verb + short argument for the collapsed tool card. */
function describe(name: string, input: unknown): { verb: string; arg: string } {
  const i = (input ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const file = (p: string) => p.split('/').slice(-2).join('/');
  switch (name) {
    case 'Read': return { verb: 'Read', arg: file(s(i.file_path)) };
    case 'Write': return { verb: 'Wrote', arg: file(s(i.file_path)) };
    case 'Edit': case 'MultiEdit': case 'NotebookEdit': return { verb: 'Edited', arg: file(s(i.file_path)) };
    case 'Bash': return { verb: 'Ran', arg: s(i.description) || s(i.command) };
    case 'Glob': case 'Grep': return { verb: 'Searched files', arg: `${s(i.pattern)} ${s(i.path)}`.trim() };
    case 'WebFetch': return { verb: 'Opened web page', arg: s(i.url) };
    case 'WebSearch': return { verb: 'Searched the web', arg: s(i.query) };
    case 'Agent': case 'Task': return { verb: 'Delegated', arg: s(i.description) };
    default: {
      const json = JSON.stringify(i);
      return { verb: name, arg: json.length > 100 ? `${json.slice(0, 97)}…` : json };
    }
  }
}

type ToolUse = Extract<Block, { type: 'tool_use' }>;
type ToolResult = Extract<Block, { type: 'tool_result' }>;

export function MessageView({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    const text = message.blocks.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return <div className="msg user"><div className="bubble">{text}</div></div>;
  }

  const results = new Map<string, ToolResult>();
  for (const b of message.blocks) if (b.type === 'tool_result') results.set(b.toolUseId, b);

  const rendered: ReactElement[] = [];
  message.blocks.forEach((b, idx) => {
    const isLast = idx === message.blocks.length - 1;
    if (b.type === 'text') {
      if (!b.text.trim() && !message.streaming) return;
      rendered.push(
        <div key={idx} className={`md${message.streaming && isLast ? ' cursor' : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.text}</ReactMarkdown>
        </div>,
      );
    } else if (b.type === 'thinking') {
      rendered.push(
        <details key={idx} className="thinking">
          <summary>{message.streaming && isLast ? 'Thinking…' : 'Thoughts'}</summary>
          <pre>{b.text}</pre>
        </details>,
      );
    } else if (b.type === 'tool_use') {
      rendered.push(<ToolCard key={idx} use={b} result={results.get(b.id)} pending={message.streaming && !results.has(b.id)} />);
    }
  });

  return (
    <div className="msg assistant">
      <div className="bubble">
        {rendered}
        {message.error && <div className="msg-error">⚠ {message.error}</div>}
        {!rendered.length && !message.error && message.streaming && <div className="muted tiny" style={{ padding: '6px 0' }}>…</div>}
      </div>
    </div>
  );
}

function ToolCard({ use, result, pending }: { use: ToolUse; result?: ToolResult; pending?: boolean }) {
  const input = (use.input ?? {}) as Record<string, unknown>;
  const { verb, arg } = describe(use.name, use.input);
  return (
    <details className={`tool${result?.isError ? ' error' : ''}`}>
      <summary>
        {pending ? <span className="spinner" /> : <span className="muted">{result?.isError ? '✕' : '✓'}</span>}
        <span className="name">{verb}</span>
        <span className="arg" title={arg}>{arg}</span>
      </summary>
      <div className="body">
        {use.name === 'Bash' && typeof input.command === 'string'
          ? <pre>$ {input.command}</pre>
          : use.name === 'Write' && typeof input.content === 'string'
            ? <><div className="muted tiny">{String(input.file_path)}</div><pre>{input.content}</pre></>
            : use.name === 'Edit' && typeof input.old_string === 'string'
              ? <><div className="result-label">Replaced</div><pre>{input.old_string}</pre><div className="result-label">With</div><pre>{String(input.new_string ?? '')}</pre></>
              : <pre>{JSON.stringify(input, null, 2)}</pre>}
        {result && (
          <>
            <div className="result-label">{result.isError ? 'Problem' : 'Result'}</div>
            <pre>{result.content || '(empty)'}</pre>
          </>
        )}
      </div>
    </details>
  );
}
