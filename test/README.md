# Tests

Zero-dependency smoke tests using Node's built-in test runner (`node:test`).

Run them with:

```sh
node --test test/*.test.js
```

(Plain `node --test test/` — passing the bare directory — trips a bug in
some Node builds where it tries to `require()` the directory itself instead
of discovering files in it; `node --test` with no path at all also works,
since it auto-discovers `test/**/*.test.js`, but the explicit glob is more
predictable in CI.)

Requires Node 18+ (the tests use the global `fetch`). They spawn the real
`server.js` on port 4123 and reset `data/orders.json` (via `DELETE
/api/orders`) before and after the run, so they're safe to run against the
shared dev data file.

If `package.json` gets a `test` script added, this should be:

```json
"scripts": {
  "test": "node --test test/*.test.js"
}
```
