// Smoke tests for server.js using node's built-in test runner.
// Run with: node --test test/
//
// Spawns the real server.js (no mocking) on a dedicated port so it doesn't
// clash with a dev instance, and resets the shared data/orders.json before
// and after the run so these tests don't leave junk behind for other agents
// working on this repo.
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PORT = 4123;
const BASE = `http://localhost:${PORT}`;

let child;

function waitForServer(timeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt() {
      fetch(`${BASE}/api/state`)
        .then((res) => {
          if (res.ok) return resolve();
          retry();
        })
        .catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) return reject(new Error('server did not start in time'));
        setTimeout(attempt, 100);
      }
    })();
  });
}

before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();
  // Reset the shared board so this run starts from a clean slate.
  await fetch(`${BASE}/api/orders`, { method: 'DELETE' });
});

after(async () => {
  // Leave the shared data file clean for whoever runs the server next.
  try {
    await fetch(`${BASE}/api/orders`, { method: 'DELETE' });
  } catch (_) { /* server may already be gone */ }
  if (child && child.pid) {
    process.kill(child.pid, 'SIGTERM');
  }
});

test('GET / returns 200 html', async () => {
  const res = await fetch(`${BASE}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /html/);
  const body = await res.text();
  assert.match(body, /<html/i);
});

test('GET /orders returns 200', async () => {
  const res = await fetch(`${BASE}/orders`);
  assert.equal(res.status, 200);
});

test('GET /api/state returns 200 with an orders array', async () => {
  const res = await fetch(`${BASE}/api/state`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.orders));
});

test('POST /api/orders creates an order and returns 201 with an id', async () => {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ada', item: 'Beer', qty: 2, note: 'cold please' }),
  });
  assert.equal(res.status, 201);
  const order = await res.json();
  assert.ok(Number.isInteger(order.id));
  assert.equal(order.name, 'Ada');
  assert.equal(order.item, 'Beer');
  assert.equal(order.qty, 2);
  assert.equal(order.delivered, 0);
});

test('POST /api/orders with missing name returns 400', async () => {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: 'Beer', qty: 1 }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test('PATCH deliverDelta increments delivered and caps at qty', async () => {
  const created = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Grace', item: 'Wine', qty: 2 }),
  }).then((r) => r.json());

  const first = await fetch(`${BASE}/api/orders/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deliverDelta: 1 }),
  }).then((r) => r.json());
  assert.equal(first.delivered, 1);

  // Overshoot: qty is 2, delivering 5 more should cap at 2, not go to 6.
  const capped = await fetch(`${BASE}/api/orders/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deliverDelta: 5 }),
  }).then((r) => r.json());
  assert.equal(capped.delivered, 2);
  assert.equal(capped.delivered, capped.qty);
});

test('DELETE /api/orders/:id removes the order', async () => {
  const created = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Linus', item: 'Cola', qty: 1 }),
  }).then((r) => r.json());

  const del = await fetch(`${BASE}/api/orders/${created.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);

  const state = await fetch(`${BASE}/api/state`).then((r) => r.json());
  assert.ok(!state.orders.some((o) => o.id === created.id));
});

test('path traversal request does not return server source', async () => {
  const res = await fetch(`${BASE}/../server.js`);
  const body = await res.text();
  assert.notEqual(res.status, 200);
  assert.ok(!body.includes('require('));
  assert.ok(!body.includes('http.createServer'));
});
