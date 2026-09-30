import type { SessionStatus } from '../shared/types.js';
import type { Launch } from './agents.js';
import { HttpError, TERMINAL_PORT } from './paths.js';

/** API-server side client for the terminal host process. */
const BASE = `http://127.0.0.1:${TERMINAL_PORT}`;

async function call<T>(method: string, pathname: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${pathname}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new HttpError(503, 'The terminal host is not running. Restart the app (close its window and start it again).');
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new HttpError(500, data.error ?? 'terminal host error');
  return data;
}

export const terminals = {
  spawn: (id: string, launch: Launch) => call<{ alive: boolean; pid: number }>('POST', '/spawn', { id, ...launch }),
  status: (id: string) => call<SessionStatus>('GET', `/status/${id}`),
  kill: (id: string) => call<{ ok: true }>('POST', `/kill/${id}`),
  healthy: async (): Promise<boolean> => {
    try { await call('GET', '/health'); return true; } catch { return false; }
  },
};
