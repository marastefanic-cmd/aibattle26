import type { ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Block, ChatMessage } from '../../../shared/types';

/** Short one-line description of a tool call for the collapsed card. */
function summarize(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  switch (name) {
    case 'Read': case 'Write': case 'Edit': case 'MultiEdit': case 'NotebookEdit': return s(i.file_path);
    case 'Bash': return s(i.command);
    case 'Glob': return `${s(i.pattern)} ${s(i.path)}`.trim();
    case 'Grep': return `/${s(i.pattern)}/ ${s(i.path)}`.trim();
    case 'WebFetch': return s(i.url);
    case 'WebSearch': return s(i.query);
    case 'Agent': case 'Task': return s(i.description);
    default: {
      const json = JSON.stringify(i);
      return json.length > 120 ? `${json.slice(0, 117)}…` : json;
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

  // Pair tool results with their tool_use so they render inside one card.
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
          <summary>Thinking{message.streaming && isLast ? '…' : ''}</summary>
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
  return (
    <details className={`tool${result?.isError ? ' error' : ''}`}>
      <summary>
        {pending ? <span className="spinner" /> : <span className="muted">{result?.isError ? '✕' : '✓'}</span>}
        <span className="name">{use.name}</span>
        <span className="arg" title={summarize(use.name, use.input)}>{summarize(use.name, use.input)}</span>
      </summary>
      <div className="body">
        {use.name === 'Bash' && typeof input.command === 'string'
          ? <pre>$ {input.command}</pre>
          : use.name === 'Write' && typeof input.content === 'string'
            ? <><div className="muted tiny">{String(input.file_path)}</div><pre>{input.content}</pre></>
            : use.name === 'Edit' && typeof input.old_string === 'string'
              ? <><div className="result-label">Replace</div><pre>{input.old_string}</pre><div className="result-label">With</div><pre>{String(input.new_string ?? '')}</pre></>
              : <pre>{JSON.stringify(input, null, 2)}</pre>}
        {result && (
          <>
            <div className="result-label">{result.isError ? 'Error' : 'Result'}</div>
            <pre>{result.content || '(empty)'}</pre>
          </>
        )}
      </div>
    </details>
  );
}
