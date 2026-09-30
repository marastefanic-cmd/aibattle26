# Rulebook Studio

A simple, local AI workbench for reviewing boardgame rulebook translations, built for a
translator who does not want to know how AI tools work.

Three parts, three colours:

- **★ Persistent instructions** — standing rules the AI reads before every session, in every game.
  You never edit files: press **＋ Tell the AI what to change** and describe the rule.
- **🎲 Games** — one folder per game with its original rules, translation, glossary, changelog and
  buglist, plus game-specific instructions. Press **＋ New session** and tell the AI what to check
  (spelling, terminology consistency, bold/italic conventions, comparison with the original…).
- **⚙ The app** — the Claude connection, and **＋ Ask for a change in the app**: describe a change
  and the AI edits the app's own code. It hot-reloads, so the change is live in seconds.

Claude is connected once through a guided sign-in (Claude subscription or API key) and stays connected.

## Install

See [SETUP.md](SETUP.md). Short version: install Node.js, double-click `start.command` (Mac) or
`start.bat` (Windows), connect Claude when asked.

## For developers

```bash
npm install
npm run dev          # API on :3210 (restarts on change), UI on http://localhost:5173 (HMR)
npm run typecheck    # strict TypeScript for server and client
```

Built on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk): every session is an
agent with file tools, a system prompt assembled from the selected files, and a permission prompt
in the UI for anything beyond editing files inside this folder. [APP_GUIDE.md](APP_GUIDE.md)
describes the code layout and is also what the AI reads before modifying the app.

```
server/     Express API: auth flow, files/projects/sessions on disk, context builder, agent runner, SSE
client/     React UI: nav, setup wizard, the three section pages, chat
shared/     types used by both
workspace/  the user's data (see SETUP.md)
```
