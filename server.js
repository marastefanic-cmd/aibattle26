// Zero-dependency HTTP server for the BarCamp ordering board.
// Serves the static UI from ./public and a small JSON API backed by data/orders.json.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'orders.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const TETRIS_DIR = path.join(__dirname, 'tetris');

// Pretty routes -> files (served from PUBLIC_DIR unless absolute)
const ROUTES = {
  '/': 'index.html',
  '/orders': 'orders.html',
  '/orders/': 'orders.html',
  '/tetris': path.join(TETRIS_DIR, 'index.html'),
  '/tetris/': path.join(TETRIS_DIR, 'index.html'),
};

// ---------- persistence ----------
function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.orders)) return parsed;
  } catch (_) { /* fresh start */ }
  return { orders: [], nextId: 1 };
}

let state = loadState();

function saveState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// ---------- helpers ----------
function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) { reject(new Error('Body too large')); req.destroy(); } });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanText(v, maxLen) {
  return String(v == null ? '' : v).trim().slice(0, maxLen);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  let file;
  if (ROUTES[rel]) {
    file = path.isAbsolute(ROUTES[rel]) ? ROUTES[rel] : path.join(PUBLIC_DIR, ROUTES[rel]);
  } else if (rel.startsWith('/tetris/')) {
    file = path.normalize(path.join(TETRIS_DIR, rel.slice('/tetris/'.length)));
    if (!file.startsWith(TETRIS_DIR)) return send(res, 403, 'Forbidden');
  } else {
    file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  }
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

// ---------- API ----------
async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'orders', id?]
  const resource = parts[1];
  const id = parts[2] ? parseInt(parts[2], 10) : null;

  if (resource === 'state' && req.method === 'GET') {
    return send(res, 200, { orders: state.orders, serverTime: Date.now() });
  }

  if (resource === 'orders') {
    if (req.method === 'POST') {
      const body = await readJson(req);
      const name = cleanText(body.name, 60);
      const item = cleanText(body.item, 80);
      const qty = clampInt(body.qty, 1, 999, 1);
      const note = cleanText(body.note, 200);
      if (!name) return send(res, 400, { error: 'Name is required' });
      if (!item) return send(res, 400, { error: 'Item is required' });
      const order = {
        id: state.nextId++,
        name,
        item,
        qty,
        note,
        delivered: 0,
        createdAt: Date.now(),
      };
      state.orders.push(order);
      saveState();
      return send(res, 201, order);
    }

    if (id != null && (req.method === 'PATCH' || req.method === 'PUT')) {
      const order = state.orders.find((o) => o.id === id);
      if (!order) return send(res, 404, { error: 'Order not found' });
      const body = await readJson(req);
      if (body.name !== undefined) { const n = cleanText(body.name, 60); if (n) order.name = n; }
      if (body.item !== undefined) { const i = cleanText(body.item, 80); if (i) order.item = i; }
      if (body.note !== undefined) order.note = cleanText(body.note, 200);
      if (body.qty !== undefined) order.qty = clampInt(body.qty, 1, 999, order.qty);
      if (body.delivered !== undefined) order.delivered = clampInt(body.delivered, 0, 999, order.delivered);
      if (body.deliverDelta !== undefined) order.delivered = clampInt(order.delivered + clampInt(body.deliverDelta, -999, 999, 0), 0, 999, order.delivered);
      if (body.done === true) order.delivered = order.qty;
      if (body.done === false) order.delivered = 0;
      order.delivered = Math.min(order.delivered, order.qty);
      order.updatedAt = Date.now();
      saveState();
      return send(res, 200, order);
    }

    if (id != null && req.method === 'DELETE') {
      const idx = state.orders.findIndex((o) => o.id === id);
      if (idx === -1) return send(res, 404, { error: 'Order not found' });
      const [removed] = state.orders.splice(idx, 1);
      saveState();
      return send(res, 200, removed);
    }

    if (id == null && req.method === 'DELETE') {
      // Clear the whole board (used by the "New round" button).
      state = { orders: [], nextId: 1 };
      saveState();
      return send(res, 200, { ok: true });
    }
  }

  return send(res, 404, { error: 'Unknown API route' });
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    return send(res, 400, { error: err.message || 'Bad request' });
  }
});

server.listen(PORT, () => {
  console.log(`BarCamp orders board running at http://localhost:${PORT}`);
});
