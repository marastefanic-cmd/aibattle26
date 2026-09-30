import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR, GLOBAL_DIR, HttpError, PROJECTS_DIR } from './paths.js';
import { api } from './routes.js';

// Load .env (API key etc.) without an extra dependency.
const envFile = path.join(APP_DIR, '.env');
if (fs.existsSync(envFile)) {
  try { process.loadEnvFile(envFile); } catch (err) { console.warn('Could not load .env:', err); }
}

fs.mkdirSync(GLOBAL_DIR, { recursive: true });
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

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

const port = Number(process.env.PORT ?? 3210);
app.listen(port, () => {
  console.log(production
    ? `Rulebook Studio on http://localhost:${port}`
    : `Rulebook Studio API on http://localhost:${port} — open the UI at http://localhost:5173`);
});
