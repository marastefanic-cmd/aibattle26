import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { query, type Options, type PermissionResult, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { Block, ChatMessage, PermissionRequest, ServerEvent, Session } from '../shared/types.js';
import { buildContext } from './context.js';
import { APP_DIR, HttpError } from './paths.js';
import { getMessages, getProject, getSession, saveMessages, updateSession } from './store.js';

interface Pending {
  request: PermissionRequest;
  resolve: (r: PermissionResult) => void;
}

interface Run {
  sessionId: string;
  abort: AbortController;
  pending: Map<string, Pending>;
  assistant: ChatMessage;
}

/**
 * Runs agent turns. One turn at a time per session. Every tool call that the
 * SDK does not auto-accept (Bash, writes outside the app directory, …) is
 * surfaced to the UI as a permission request that the user approves or denies.
 */
class AgentManager {
  private emitters = new Map<string, EventEmitter>();
  private runs = new Map<string, Run>();

  private emitter(sessionId: string): EventEmitter {
    let e = this.emitters.get(sessionId);
    if (!e) { e = new EventEmitter(); e.setMaxListeners(50); this.emitters.set(sessionId, e); }
    return e;
  }

  subscribe(sessionId: string, listener: (ev: ServerEvent) => void): () => void {
    const e = this.emitter(sessionId);
    e.on('event', listener);
    return () => e.off('event', listener);
  }

  private emit(sessionId: string, ev: ServerEvent): void {
    this.emitter(sessionId).emit('event', ev);
  }

  isRunning(sessionId: string): boolean {
    return this.runs.has(sessionId);
  }

  pendingPermissions(sessionId: string): PermissionRequest[] {
    return [...(this.runs.get(sessionId)?.pending.values() ?? [])].map((p) => p.request);
  }

  /** Current in-progress assistant message, if a turn is running. */
  currentAssistant(sessionId: string): ChatMessage | undefined {
    return this.runs.get(sessionId)?.assistant;
  }

  resolvePermission(sessionId: string, requestId: string, allow: boolean): void {
    const run = this.runs.get(sessionId);
    const p = run?.pending.get(requestId);
    if (!run || !p) throw new HttpError(404, 'No such pending permission request');
    run.pending.delete(requestId);
    p.resolve(allow
      ? { behavior: 'allow', updatedInput: p.request.input }
      : { behavior: 'deny', message: 'The user denied this action.' });
    this.emit(sessionId, { type: 'permission_resolved', requestId });
  }

  abort(sessionId: string): void {
    const run = this.runs.get(sessionId);
    if (!run) return;
    for (const [id, p] of run.pending) {
      p.resolve({ behavior: 'deny', message: 'The turn was cancelled.' });
      this.emit(sessionId, { type: 'permission_resolved', requestId: id });
    }
    run.pending.clear();
    run.abort.abort();
  }

  async send(projectId: string, sessionId: string, text: string): Promise<void> {
    if (this.runs.has(sessionId)) throw new HttpError(409, 'A turn is already running in this session');
    const project = await getProject(projectId);
    let session = await getSession(projectId, sessionId);
    const messages = await getMessages(projectId, sessionId);

    const userMsg: ChatMessage = { id: randomUUID(), role: 'user', createdAt: new Date().toISOString(), blocks: [{ type: 'text', text }] };
    messages.push(userMsg);
    if (session.title === 'New session') {
      session = await updateSession(projectId, sessionId, { title: text.replace(/\s+/g, ' ').trim().slice(0, 60) || 'New session' });
      this.emit(sessionId, { type: 'session', session });
    }
    await saveMessages(projectId, sessionId, messages);
    this.emit(sessionId, { type: 'message', message: userMsg });

    const assistant: ChatMessage = { id: randomUUID(), role: 'assistant', createdAt: new Date().toISOString(), blocks: [], streaming: true };
    const run: Run = { sessionId, abort: new AbortController(), pending: new Map(), assistant };
    this.runs.set(sessionId, run);
    this.emit(sessionId, { type: 'message', message: assistant });

    // Run in the background; the HTTP request returns immediately.
    void this.runTurn(project.id, session, run, text, messages).finally(() => this.runs.delete(sessionId));
  }

  private async runTurn(projectId: string, session: Session, run: Run, prompt: string, messages: ChatMessage[]): Promise<void> {
    const { sessionId, assistant } = run;
    const emit = (ev: ServerEvent) => this.emit(sessionId, ev);
    const snapshot = () => emit({ type: 'message', message: assistant });
    let costUsd: number | undefined;

    try {
      const project = await getProject(projectId);
      const ctx = await buildContext(project, session);
      emit({ type: 'status', text: `Context: ${ctx.inlineFiles.length} inlined, ${ctx.referenceFiles.length} referenced, ~${ctx.tokens.toLocaleString()} tokens` });

      const canUseTool: Options['canUseTool'] = (toolName, input, { signal }) =>
        new Promise<PermissionResult>((resolve) => {
          const request: PermissionRequest = { id: randomUUID(), sessionId, toolName, input, createdAt: new Date().toISOString() };
          run.pending.set(request.id, { request, resolve });
          emit({ type: 'permission_request', request });
          signal.addEventListener('abort', () => {
            if (run.pending.delete(request.id)) resolve({ behavior: 'deny', message: 'Cancelled.' });
          });
        });

      const options: Options = {
        cwd: APP_DIR,
        model: session.model,
        effort: session.effort,
        thinking: { type: 'adaptive', display: 'summarized' },
        systemPrompt: { type: 'custom', prompt: ctx.systemPrompt },
        includePartialMessages: true,
        abortController: run.abort,
        settingSources: [],
        resume: session.sdkSessionId,
        persistSession: true,
        // File edits inside the app directory are accepted; everything else asks the user.
        permissionMode: 'acceptEdits',
        canUseTool,
      };

      const q = query({ prompt, options });
      for await (const msg of q) {
        await this.handleMessage(msg, run, projectId, session, snapshot, emit);
        if (msg.type === 'result') costUsd = msg.total_cost_usd;
      }
    } catch (err) {
      if (run.abort.signal.aborted) {
        assistant.error = 'Cancelled';
      } else {
        const text = err instanceof Error ? err.message : String(err);
        assistant.error = text;
        emit({ type: 'error', text });
      }
    }

    assistant.streaming = false;
    assistant.blocks = assistant.blocks.filter((b) => !(b.type === 'thinking' && !b.text.trim()));
    messages.push(assistant);
    await saveMessages(projectId, sessionId, messages);
    if (costUsd !== undefined) {
      const s = await updateSession(projectId, sessionId, { totalCostUsd: costUsd });
      emit({ type: 'session', session: s });
    }
    snapshot();
    emit({ type: 'turn_end', messageId: assistant.id, costUsd });
  }

  private async handleMessage(
    msg: SDKMessage, run: Run, projectId: string, session: Session,
    snapshot: () => void, emit: (ev: ServerEvent) => void,
  ): Promise<void> {
    const { assistant, sessionId } = run;
    switch (msg.type) {
      case 'system': {
        if (msg.subtype === 'init' && msg.session_id && msg.session_id !== session.sdkSessionId) {
          session.sdkSessionId = msg.session_id;
          const s = await updateSession(projectId, sessionId, { sdkSessionId: msg.session_id });
          emit({ type: 'session', session: s });
        }
        return;
      }
      case 'stream_event': {
        if (msg.parent_tool_use_id) return; // subagent chatter
        const ev = msg.event;
        if (ev.type === 'content_block_start') {
          const b = ev.content_block;
          if (b.type === 'text') assistant.blocks.push({ type: 'text', text: '' });
          else if (b.type === 'thinking') assistant.blocks.push({ type: 'thinking', text: '' });
          else if (b.type === 'tool_use') assistant.blocks.push({ type: 'tool_use', id: b.id, name: b.name, input: {} });
          snapshot();
        } else if (ev.type === 'content_block_delta') {
          const last = assistant.blocks[assistant.blocks.length - 1];
          if (ev.delta.type === 'text_delta' && last?.type === 'text') {
            last.text += ev.delta.text;
            emit({ type: 'text_delta', messageId: assistant.id, text: ev.delta.text });
          } else if (ev.delta.type === 'thinking_delta' && last?.type === 'thinking') {
            last.text += ev.delta.thinking;
            emit({ type: 'thinking_delta', messageId: assistant.id, text: ev.delta.thinking });
          }
        }
        return;
      }
      case 'assistant': {
        if (msg.parent_tool_use_id) return;
        // Complete blocks: reconcile so tool inputs and final text are exact.
        for (const b of msg.message.content) {
          if (b.type === 'tool_use') {
            const existing = assistant.blocks.find((x): x is Extract<Block, { type: 'tool_use' }> => x.type === 'tool_use' && x.id === b.id);
            if (existing) existing.input = b.input;
            else assistant.blocks.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input });
          } else if (b.type === 'text') {
            const last = assistant.blocks[assistant.blocks.length - 1];
            if (last?.type === 'text') last.text = b.text;
            else if (!assistant.blocks.some((x) => x.type === 'text' && x.text === b.text)) assistant.blocks.push({ type: 'text', text: b.text });
          }
        }
        if (msg.error) assistant.error = msg.error;
        snapshot();
        return;
      }
      case 'user': {
        if (msg.parent_tool_use_id) return;
        const content = msg.message.content;
        if (typeof content === 'string') return;
        for (const b of content) {
          if (b.type !== 'tool_result') continue;
          const text = typeof b.content === 'string'
            ? b.content
            : (b.content ?? []).map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n');
          assistant.blocks.push({ type: 'tool_result', toolUseId: b.tool_use_id, content: text.slice(0, 20_000), isError: b.is_error ?? undefined });
        }
        snapshot();
        return;
      }
      case 'result': {
        if (msg.subtype !== 'success') {
          const errs = 'errors' in msg ? msg.errors : [];
          assistant.error = `${msg.subtype}${errs.length ? `: ${errs.join('; ')}` : ''}`;
        }
        return;
      }
      default:
        return;
    }
  }
}

export const agents = new AgentManager();
