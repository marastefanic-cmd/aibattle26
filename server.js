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
  '/roast': 'roast.html',
  '/roast/': 'roast.html',
  '/tetris': path.join(TETRIS_DIR, 'index.html'),
  '/tetris/': path.join(TETRIS_DIR, 'index.html'),
};

// ---------- persistence ----------
function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.orders)) {
      // Backwards compatible with files written before "requests" existed.
      if (!Array.isArray(parsed.requests)) parsed.requests = [];
      if (!Number.isInteger(parsed.nextRequestId)) parsed.nextRequestId = 1;
      return parsed;
    }
  } catch (_) { /* fresh start */ }
  return emptyState();
}

function emptyState() {
  return { orders: [], nextId: 1, requests: [], nextRequestId: 1 };
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

// ---------- menu ----------
// Single source of truth for the bar menu: served as JSON (/api/menu) and as a
// hand-written PDF (/api/menu.pdf). Prices in EUR.
const MENU = [
  { category: 'Beer', items: [
    { name: 'Pilsner 0.5l', price: 4.5 },
    { name: 'Pilsner 0.3l', price: 3.2 },
    { name: 'Wheat beer 0.5l', price: 4.8 },
    { name: 'IPA 0.4l', price: 5.5 },
    { name: 'Radler 0.5l', price: 4.2 },
    { name: 'Non-alcoholic beer 0.5l', price: 4.0 },
  ] },
  { category: 'Wine', items: [
    { name: 'White wine 0.2l', price: 4.5 },
    { name: 'Red wine 0.2l', price: 4.5 },
    { name: 'Rosé 0.2l', price: 4.5 },
    { name: 'Spritzer 0.25l', price: 3.8 },
    { name: 'Prosecco 0.1l', price: 4.9 },
  ] },
  { category: 'Cocktails & Long drinks', items: [
    { name: 'Aperol Spritz', price: 7.5 },
    { name: 'Gin tonic', price: 8.0 },
    { name: 'Moscow Mule', price: 8.5 },
    { name: 'Mojito', price: 8.5 },
    { name: 'Cuba Libre', price: 7.5 },
    { name: 'Whisky sour', price: 9.0 },
  ] },
  { category: 'Soft drinks', items: [
    { name: 'Cola 0.33l', price: 3.0 },
    { name: 'Lemonade 0.33l', price: 3.0 },
    { name: 'Apple spritzer 0.5l', price: 3.2 },
    { name: 'Mate 0.5l', price: 3.5 },
    { name: 'Sparkling water 0.5l', price: 2.5 },
    { name: 'Still water 0.5l', price: 2.5 },
  ] },
  { category: 'Hot drinks', items: [
    { name: 'Coffee', price: 2.8 },
    { name: 'Espresso', price: 2.2 },
    { name: 'Cappuccino', price: 3.4 },
    { name: 'Tea', price: 2.5 },
    { name: 'Hot chocolate', price: 3.4 },
  ] },
  { category: 'Food', items: [
    { name: 'Fries', price: 4.0 },
    { name: 'Pizza Margherita', price: 9.5 },
    { name: 'Pizza Salami', price: 10.5 },
    { name: 'Burger', price: 11.0 },
    { name: 'Veggie burger', price: 10.5 },
    { name: 'Pretzel', price: 2.5 },
    { name: 'Nachos', price: 6.5 },
  ] },
];

function menuPrice(p) { return p.toFixed(2) + ' EUR'; }

// Escape a string for use inside a PDF literal string "( … )" with the
// WinAnsiEncoding used by the standard Helvetica font. Non-Latin-1 characters
// are replaced so the byte offsets stay exact (PDF strings are bytes).
function pdfText(s) {
  return String(s)
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/€/g, 'EUR')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Rough Helvetica width (in 1/1000 em) for right-aligning prices without font metrics.
function textWidth(s, size) {
  let w = 0;
  for (const ch of String(s)) {
    if ('iljtfI.,:;\'!| '.includes(ch)) w += 278;
    else if ('mwMW'.includes(ch)) w += 833;
    else if (ch >= 'A' && ch <= 'Z') w += 667;
    else w += 556;
  }
  return (w / 1000) * size;
}

// Build a minimal, valid PDF 1.4 by hand: catalog, pages, N pages that share
// a Helvetica / Helvetica-Bold font resource, one text content stream per page,
// and an xref table with exact byte offsets. Returns a Buffer.
function buildMenuPdf() {
  const W = 595.28, H = 841.89; // A4 in points
  const margin = 56, top = H - 64, bottom = 70;
  const pageStreams = [];
  let ops = [];
  let y = top;
  let pageNo = 1;

  const line = (font, size, x, yy, text) => ops.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${pdfText(text)}) Tj ET`);
  const rule = (yy, gray) => ops.push(`${gray} G 0.6 w ${margin} ${yy.toFixed(2)} m ${(W - margin).toFixed(2)} ${yy.toFixed(2)} l S`);
  const footer = () => {
    rule(bottom - 8, 0.75);
    line('F1', 9, margin, bottom - 22, 'Order at the board: /orders');
    const p = `Page ${pageNo}`;
    line('F1', 9, W - margin - textWidth(p, 9), bottom - 22, p);
  };
  const newPage = () => { footer(); pageStreams.push(ops.join('\n')); ops = []; y = top; pageNo++; };
  const ensure = (need) => { if (y - need < bottom) newPage(); };

  // Title block (first page only)
  line('F2', 26, margin, y, 'BarCamp Bar Menu');
  y -= 16;
  line('F1', 11, margin, y, 'Everything on this list can be ordered at the shared board. Prices in EUR.');
  y -= 10;
  rule(y, 0.2);
  y -= 30;

  for (const cat of MENU) {
    ensure(22 + 16 * Math.min(cat.items.length, 2));
    line('F2', 15, margin, y, cat.category);
    y -= 6;
    rule(y, 0.6);
    y -= 18;
    for (const it of cat.items) {
      ensure(16);
      line('F1', 11.5, margin + 6, y, it.name);
      const price = menuPrice(it.price);
      line('F1', 11.5, W - margin - textWidth(price, 11.5), y, price);
      y -= 16;
    }
    y -= 14;
  }
  footer();
  pageStreams.push(ops.join('\n'));

  // ----- assemble objects -----
  // 1 catalog, 2 pages, 3 font regular, 4 font bold, then per page: page obj + content obj
  const objects = [];
  const pageObjIds = pageStreams.map((_, i) => 5 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((n) => n + ' 0 R').join(' ')}] /Count ${pageStreams.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pageStreams.forEach((stream, i) => {
    const pid = pageObjIds[i], cid = pid + 1;
    objects[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`;
    const bytes = Buffer.from(stream, 'latin1');
    objects[cid] = { head: `<< /Length ${bytes.length} >>`, stream: bytes };
  });

  const chunks = [];
  let offset = 0;
  const push = (buf) => { chunks.push(buf); offset += buf.length; };
  push(Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1'));
  const offsets = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = offset;
    const o = objects[n];
    if (typeof o === 'string') {
      push(Buffer.from(`${n} 0 obj\n${o}\nendobj\n`, 'latin1'));
    } else {
      push(Buffer.from(`${n} 0 obj\n${o.head}\nstream\n`, 'latin1'));
      push(o.stream);
      push(Buffer.from('\nendstream\nendobj\n', 'latin1'));
    }
  }
  const xrefOffset = offset;
  const count = objects.length; // includes the free object 0
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) xref += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
  push(Buffer.from(xref, 'latin1'));
  push(Buffer.from(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(chunks);
}

// ---------- API ----------
async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'orders', id?]
  const resource = parts[1];
  const id = parts[2] ? parseInt(parts[2], 10) : null;

  if (resource === 'state' && req.method === 'GET') {
    return send(res, 200, { orders: state.orders, requests: state.requests, serverTime: Date.now() });
  }

  if (resource === 'menu' && req.method === 'GET') {
    return send(res, 200, { currency: 'EUR', menu: MENU });
  }

  if (resource === 'menu.pdf' && (req.method === 'GET' || req.method === 'HEAD')) {
    const pdf = buildMenuPdf();
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': pdf.length,
      'Content-Disposition': 'inline; filename="barcamp-menu.pdf"',
      'Cache-Control': 'no-cache',
    });
    return res.end(req.method === 'HEAD' ? undefined : pdf);
  }

  if (resource === 'requests') {
    if (req.method === 'POST') {
      const body = await readJson(req);
      const name = cleanText(body.name, 60);
      const text = cleanText(body.text, 300);
      if (!name) return send(res, 400, { error: 'Name is required' });
      if (!text) return send(res, 400, { error: 'Request text is required' });
      const request = { id: state.nextRequestId++, name, text, done: false, createdAt: Date.now() };
      state.requests.push(request);
      saveState();
      return send(res, 201, request);
    }
    if (id != null && (req.method === 'PATCH' || req.method === 'PUT')) {
      const request = state.requests.find((r) => r.id === id);
      if (!request) return send(res, 404, { error: 'Request not found' });
      const body = await readJson(req);
      if (body.done !== undefined) request.done = body.done === true || body.done === 'true' || body.done === 1;
      if (body.text !== undefined) { const t = cleanText(body.text, 300); if (t) request.text = t; }
      request.updatedAt = Date.now();
      saveState();
      return send(res, 200, request);
    }
    if (id != null && req.method === 'DELETE') {
      const idx = state.requests.findIndex((r) => r.id === id);
      if (idx === -1) return send(res, 404, { error: 'Request not found' });
      const [removed] = state.requests.splice(idx, 1);
      saveState();
      return send(res, 200, removed);
    }
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
      // Clear the whole board, orders and requests (used by the "New round" button).
      state = emptyState();
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
