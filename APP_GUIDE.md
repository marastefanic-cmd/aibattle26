# Rulebook Studio — how it works (for developers and for the AI that modifies it)

A local web app for reviewing boardgame rulebook translations with a command-line AI
assistant (Claude Code by default). The user is a professional translator with no technical
background. Every design decision favours "one obvious button" over configurability.

## The idea in one paragraph

The app is a file organiser plus a launcher. It keeps **persistent instructions** (Markdown
files the assistant must always follow), one folder per **game** (original rules, translation,
glossary, changelog, buglist, game-specific instructions), and opens **sessions**: a real
terminal running the assistant CLI, started with a generated context file so the assistant
already knows the instructions and the game's files. The assistant's own UI handles sign-in
(`/login`), permissions and everything else. The app itself hot-reloads, and one kind of
session exists just to let the assistant modify the app.

## The three sections

| Section | Colour | Data | Session kind |
|---|---|---|---|
| **Persistent instructions** | purple (`--instr`) | `workspace/global/*.md` | `instructions` with owner `_global` |
| **Games** (projects) | terracotta (`--game`) | `workspace/projects/<id>/` | `work` with owner `<id>`; `instructions` with owner `<id>` targets the game's `instructions/` folder |
| **The app** | blue (`--app`) | this repository | `app` with owner `_app` |

## Sessions and the terminal host

`server/terminal-host.ts` is a **separate process** (started by `scripts/dev-server.mjs`)
that owns the assistant terminals via node-pty and serves them over WebSocket (`/term/<id>`).
The API server (`server/index.ts`) restarts whenever server code changes; the terminal host
does not, so running assistants survive hot reloads — including reloads caused by the
assistant editing the app.

Launching a session (`POST /api/sessions/:owner/:id/launch`):

1. `server/context.ts` builds the context text for the session's kind and writes it to
   `<session dir>/context.md`.
2. `server/agents.ts` builds the command line. Claude Code:
   `claude --append-system-prompt-file <context.md> --permission-mode acceptEdits --session-id <id>`
   (later launches use `--resume <id>` so the conversation continues). Codex gets the app
   folder as cwd and a first prompt telling it to read the context file. A custom command
   template gets `{context}`, `{cwd}`, `{prompt}` substituted.
3. The API asks the terminal host to spawn it; the browser's `Terminal.tsx` (xterm.js)
   attaches and replays scrollback.

The assistant's working directory is always the app folder, so it can reach both
`workspace/` and the app's code. `acceptEdits` means file edits inside the app folder
happen without prompting; shell commands and anything else prompt inside the terminal.

Session ids are UUIDs because Claude Code requires that for `--session-id`.

## Context per kind (`server/context.ts`)

- `work`: reviewer preamble + inlined persistent instructions (global, then the game's
  `instructions/`) + a list of the game's other files by absolute path (opened on demand).
  Text files over ~120 KB are listed rather than inlined.
- `instructions`: preamble telling the assistant to edit Markdown files in the target folder
  from what the user says and reply in plain words. Target files inlined; for a game, the
  global instructions are inlined too as read-only reference.
- `app`: preamble telling the assistant to modify this repository, run `npm run typecheck`,
  and explain the change without technical terms. This guide is inlined.

## Files

Uploads go under the scope root (`workspace/global/` or the game folder). `.docx` is converted
to Markdown (mammoth) and `.xlsx/.xls` to CSV (SheetJS) next to the original on upload
(`server/convert.ts`). Text files can be opened and edited in the built-in editor.

## Code layout

- `server/` — Express 5 + TypeScript
  - `paths.ts` directory layout, ports, path safety
  - `store.ts` settings / files / projects / sessions on disk (plain JSON + files)
  - `convert.ts` office → text conversion
  - `context.ts` context text per session kind
  - `agents.ts` which assistants exist and how to start them
  - `terminal-host.ts` the standalone pty + WebSocket process
  - `terminals.ts` API-side client for the host
  - `routes.ts` REST; `index.ts` boot
- `client/src/` — React 19 + Vite (HMR)
  - `App.tsx` navigation state (`View`), the `Shell` passed to pages
  - `components/Nav.tsx` · `Terminal.tsx` (xterm.js, auto-reconnect) · `FileRows.tsx`
    · `InstructionsSection.tsx` (big button + files + past sessions, reused per game)
    · `SessionList.tsx` · `FileEditor.tsx` · `HelpModal.tsx`
  - `pages/InstructionsPage.tsx`, `GamePage.tsx`, `AppPage.tsx`, `SessionPage.tsx`
  - `styles.css` — all styling; colour tokens at the top
- `shared/types.ts` — types used by both sides
- `scripts/dev-server.mjs` — supervisor: terminal host (stable) + API server (restart on change)

## Conventions when changing the app

- Keep it simple for the user: prefer one clear button and a sentence of explanation over
  settings. Wording in the UI: "the assistant", never "agent", "model", "token", "prompt".
- `npm run typecheck` must pass. Strict TypeScript on both sides.
- Data stays plain files under `workspace/`; do not change its layout without migrating.
- No heavy dependencies. Current runtime deps: express, multer, node-pty, ws, mammoth, xlsx,
  react, react-markdown, @xterm/xterm, @anthropic-ai/claude-code (for the bundled `claude`).
- Changes to `server/terminal-host.ts` or `scripts/dev-server.mjs` need a full app restart;
  say so to the user. Everything else hot-reloads.

## Running

```bash
npm install
npm start            # terminal host + API (restart on change) + Vite, opens the browser
npm run dev          # same without opening a browser
npm run typecheck
```
