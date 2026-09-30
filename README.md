# Rulebook Studio

A simple, local workbench for reviewing boardgame rulebook translations with an AI assistant,
built for a translator who does not want to know how AI tools work.

Three parts, three colours:

- **★ Persistent instructions** — standing rules the assistant reads before every session, in
  every game. You never edit files: press **＋ Tell the AI what to change** and describe the rule.
- **🎲 Games** — one folder per game with its original rules, translation, glossary, changelog and
  buglist, plus game-specific instructions. Press **＋ New session** and tell the assistant what to
  check (spelling, terminology consistency, bold/italic conventions, comparison with the original…).
- **⚙ The app** — which assistant to use (Claude Code is bundled; Codex works too), and
  **＋ Ask for a change in the app**: describe a change and the assistant edits the app's own code.
  It hot-reloads, so the change is live in seconds.

A session is a real terminal running the assistant, started with a generated context so it
already knows your instructions and the game's files. Signing in happens inside the assistant
(`/login`) and is remembered.

## Install

See [SETUP.md](SETUP.md). Short version: install Node.js, double-click `start.command` (Mac) or
`start.bat` (Windows), type `/login` in the first session.

## For developers

```bash
npm install
npm run dev          # terminal host + API server (restarts on change) + Vite UI with HMR
npm run typecheck
```

[APP_GUIDE.md](APP_GUIDE.md) describes how it fits together; it is also what the assistant
reads before modifying the app.

```
server/     Express API, context builder, assistant launcher, terminal host (node-pty + ws)
client/     React UI with xterm.js sessions
shared/     types used by both
scripts/    dev supervisor
workspace/  the user's data (see SETUP.md)
```
