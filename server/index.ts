import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { API_PORT, APP_DIR, GLOBAL_DIR, HttpError, PROJECTS_DIR, SYSTEM_SESSIONS_DIR } from './paths.js';

// Load .env (optional) without an extra dependency, before anything reads process.env.
const envFile = path.join(APP_DIR, '.env');
if (fs.existsSync(envFile)) {
  try { process.loadEnvFile(envFile); } catch (err) { console.warn('Could not load .env:', err); }
}
const { api } = await import('./routes.js');

for (const dir of [GLOBAL_DIR, PROJECTS_DIR, SYSTEM_SESSIONS_DIR]) fs.mkdirSync(dir, { recursive: true });

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use('/api', api);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : String(err);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

const production = process.env.NODE_ENV === 'production';
if (production) {
  const dist = path.join(APP_DIR, 'dist', 'client');
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(API_PORT, () => {
  console.log(production
    ? `Rulebook Studio on http://localhost:${API_PORT}`
    : `Rulebook Studio API on http://localhost:${API_PORT} — the app is at http://localhost:5173`);
});
