# Rulebook Studio

Context-managed AI sessions for reviewing boardgame rulebook translations.

You keep **global** instructions, methodology and example files in one place, put each game's
original rules, translation, glossary, changelog and buglist in a **project**, and then start
disposable **sessions** whose agent is preloaded with exactly the files you pick. Each session
does one review round (spellcheck, terminology consistency, formatting conventions, comparison
against the original…), records what it found, and can be thrown away.

Built on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk), so the agent can read
PDFs, edit files, and even modify this app (it hot-reloads).

## Quick start

```bash
cp .env.example .env    # set ANTHROPIC_API_KEY, or CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`
npm install
npm run dev             # http://localhost:5173
```

Then:

1. Edit the starter docs under **Global** in the Context panel (instructions, methodology, example).
2. Create a project, upload the original rules and the translation, fill in the glossary.
3. Start a session and tell it what to check.

See [APP_GUIDE.md](APP_GUIDE.md) for the full explanation of context modes, the round workflow and the code layout.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API server with restart-on-change (port 3210) + Vite dev server with HMR (port 5173) |
| `npm run typecheck` | Strict TypeScript check for server and client |
| `npm run build && npm start` | Build the UI and serve everything from one port |

## Layout

```
workspace/
  global/                 instructions, methodology, examples — preloaded everywhere
  projects/<game>/
    project.json          name, description, default context selection
    context/              original/, translation/, glossary, changelog, buglist, …
    output/               deliverables written by the agent
    sessions/<id>/        transcript + per-session context selection (git-ignored)
server/                   Express API + Claude Agent SDK runner
client/                   React UI
shared/                   types used by both
```
