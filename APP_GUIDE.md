# Rulebook Studio — how it works

A small personal workbench for reviewing boardgame rulebook translations with an AI agent.
Every **session** is a disposable chat with an agent that is preloaded with your global
instructions and the current project's files, so you never have to explain the setup again.

## Concepts

| Thing | Where it lives | What it is for |
|---|---|---|
| **Global docs** | `workspace/global/` | Instructions, methodology, example finished files. Preloaded into every session in every project. |
| **Project** | `workspace/projects/<id>/` | One boardgame. `project.json` holds its name and default context selection. |
| **Project context** | `…/context/` | Original rules (`context/original/`), current translation (`context/translation/`), EN-CZ glossary, changelog, buglist, anything else the agent should know. |
| **Output** | `…/output/` | Where the agent writes deliverables (review reports, corrected files). Listed to the agent by path, not inlined. |
| **Session** | `…/sessions/<id>/` | One task. Stores the transcript and which files were preloaded. Throw it away when done. |

## Context modes

Every file has a mode, shown as a three-way switch in the Context panel:

- **Inline** — the full text is placed in the system prompt when the session starts. Best for instructions, glossaries and other things the agent must follow at all times.
- **Ref** — only the absolute path is listed; the agent reads the file with its tools when it needs it. Automatic for PDFs/binaries and very large files. Good for the original rulebook PDF.
- **Off** — not mentioned at all.

Where the switch applies depends on what is selected:

- **No session selected** → you are editing the **project defaults**. New sessions copy them.
- **Session selected** → you are editing **that session's** selection. "Save as default" copies it back to the project; "Reset" drops the session's overrides.

"Preview prompt" shows the exact system prompt the agent will get. The footer shows a rough token estimate; keep it well under ~150k so the agent has room to work.

## The review round workflow

Projects converge through rounds. Each session is one round with one job, for example:

1. *Spellcheck and proofread the translation.*
2. *Check every game term against the glossary; list deviations.*
3. *Check bold/italic conventions against the methodology.*
4. *Compare translation to original for omissions and mistranslations.*

The agent is told to record findings in the buglist, record applied changes in the changelog and keep the glossary current, so the next session picks up where this one left off. Keep the three tracking files **Inline** so every round sees them.

## Permissions

File edits inside this repository (including `workspace/`) are accepted automatically. Anything else the agent wants to do — run a shell command, touch files elsewhere — shows up as an **Allow / Deny** card in the chat. Nothing runs until you answer.

## Changing the app itself

The app hot-reloads. Ask any session to change it ("add a dark mode", "show word counts in the file list") and the agent can edit its source:

- `server/` — Express API (TypeScript, restarted automatically by `tsx watch` on change)
  - `paths.ts` directory layout and path safety
  - `store.ts` files / projects / sessions on disk
  - `context.ts` builds the system prompt (preamble + inlined files + referenced paths)
  - `agent.ts` runs a turn through the Claude Agent SDK, streams events, handles permission prompts
  - `routes.ts` REST + SSE endpoints
- `client/src/` — React UI (Vite, hot module reload)
  - `App.tsx` layout and state; `components/Sidebar.tsx`, `ContextPanel.tsx`, `ChatView.tsx`, `MessageView.tsx`, `FileEditor.tsx`
  - `styles.css` all styling (CSS variables at the top)
- `shared/types.ts` — types shared by both sides

Conventions for edits: keep TypeScript strict (`npm run typecheck` must pass), keep data on disk as plain files/JSON so it stays inspectable, don't add heavy dependencies, and don't change the `workspace/` layout without migrating existing data.

## Running

```bash
cp .env.example .env   # add ANTHROPIC_API_KEY (or CLAUDE_CODE_OAUTH_TOKEN)
npm install
npm run dev            # API on :3210, UI on http://localhost:5173
```

Production-ish: `npm run build && npm start` serves the built UI from the API port.
