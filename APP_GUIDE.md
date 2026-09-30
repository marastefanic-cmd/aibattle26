# Rulebook Studio — how it works (for developers and for the AI that modifies it)

A local web app for reviewing boardgame rulebook translations with an AI. The user is a
professional translator with no technical background. Every design decision favours
"one obvious button" over configurability.

## The three sections

| Section | Colour | Data | Session kind |
|---|---|---|---|
| **Persistent instructions** | purple (`--instr`) | `workspace/global/*.md` | `instructions` with owner `_global` |
| **Games** (projects) | terracotta (`--game`) | `workspace/projects/<id>/` | `work` with owner `<id>`; `instructions` with owner `<id>` for the game's `instructions/` folder |
| **The app** | blue (`--app`) | this repository | `app` with owner `_app` |

A **session** is one chat with the AI. Its `kind` decides which system prompt it gets
(`server/context.ts`) and its `owner` decides where its transcript is stored
(`server/paths.ts` → `sessionsDir`).

- `work`: preamble about translation review + the persistent instructions (global, then the
  game's `instructions/`) + the game's files, each either inlined or listed by path.
- `instructions`: preamble telling the AI to edit Markdown files in the target folder based on
  what the user says, then reply in plain words. The target folder's files are inlined.
- `app`: preamble telling the AI to modify this repository, run `npm run typecheck`
  (pre-approved), and explain the change without technical terms. This guide is inlined.

## Context modes (per file)

`inline` = whole text in the system prompt; `reference` = path only, AI reads on demand;
`off` = hidden. Defaults (`shared/types.ts` → `defaultMode`): text files inline, binaries and
files over ~40k tokens reference, `output/` reference, uploaded `.docx/.xlsx` off (a converted
`.md`/`.csv` sits next to them). The game page shows this as an "AI reads this" checkbox with a
"Fine-tune" disclosure for the three-way choice. Project defaults live in `project.json`; a work
session snapshots them at creation into `session.context`.

## Claude connection (`server/auth.ts`)

Two ways, both persistent:

- **Claude login**: the server spawns the SDK's bundled Claude binary with `auth login`,
  captures the sign-in URL it prints, shows it in the wizard, then writes the code the user
  pastes to the process's stdin. The CLI stores the login in the user's Claude config folder,
  and the SDK subprocess picks it up automatically.
- **API key**: stored in `workspace/.local/credentials.json` (mode 600, git-ignored) and passed
  to the SDK subprocess as `ANTHROPIC_API_KEY`.

`GET /api/health` reports `auth.connected`; the UI shows the setup wizard until it is true.

## Permissions

The SDK runs with `permissionMode: 'acceptEdits'`: file edits inside this repository (which
includes `workspace/`) are accepted automatically. Anything else (shell commands, files
elsewhere, web access) goes through `canUseTool` in `server/agent.ts`, which shows an
Allow / Don't allow card in the chat. `npm run typecheck`, `npm run build` and `npx tsc` are
pre-approved so app-change sessions can verify themselves.

## Code layout

- `server/` — Express 5 + TypeScript, restarted by `tsx watch` on change
  - `paths.ts` directory layout, path safety, bundled binary lookup
  - `store.ts` files / projects / sessions on disk (plain JSON + files, no database)
  - `convert.ts` `.docx` → Markdown (mammoth), `.xlsx` → CSV (SheetJS) on upload
  - `context.ts` system prompt per session kind
  - `auth.ts` Claude login flow and API key storage
  - `agent.ts` runs a turn through the Claude Agent SDK, streams events, permission prompts
  - `routes.ts` REST + SSE; `index.ts` boot
- `client/src/` — React 19 + Vite (HMR)
  - `App.tsx` navigation state (`View`), the `Shell` passed to pages, setup wizard trigger
  - `components/Nav.tsx` left menu · `SetupWizard.tsx` · `FileRows.tsx` (list + upload + drop)
    · `InstructionsSection.tsx` (big button + files + past sessions, reused per game)
    · `SessionList.tsx` · `MessageView.tsx` (markdown, tool cards) · `FileEditor.tsx` · `HelpModal.tsx`
  - `pages/InstructionsPage.tsx`, `GamePage.tsx`, `AppPage.tsx`, `SessionPage.tsx` (the chat)
  - `styles.css` — all styling; colour tokens at the top
- `shared/types.ts` — types and the default-mode logic used by both sides

## Conventions when changing the app

- Keep it simple for the user: prefer one clear button and a sentence of explanation over
  settings. Wording in the UI: "the AI", never "agent", "model", "token", "prompt".
- `npm run typecheck` must pass. Strict TypeScript on both sides.
- Data stays plain files under `workspace/`; do not change its layout without migrating.
- No heavy dependencies. The current ones: express, multer, mammoth, xlsx, react, react-markdown.
- The dev server restarts on server changes and the browser hot-reloads on UI changes; an
  in-flight chat turn is lost when the server restarts, so warn the user if you are about to
  change `server/` while they may be mid-session.

## Running

```bash
npm install
npm start            # = dev mode with hot reload, opens the browser (what start.sh/.bat run)
npm run dev          # same without opening a browser
npm run build && npm run serve   # optional single-port production build
```
