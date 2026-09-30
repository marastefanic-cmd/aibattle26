# Setting up Rulebook Studio

For whoever installs the app on the translator's computer (a friend, or an AI assistant helping
them). About five minutes. Afterwards the translator only ever double-clicks one file.

## 1. Install Node.js

Install the **LTS** version from <https://nodejs.org>. On Windows, tick the option to install
the build tools if the installer offers it (needed for the terminal component on some setups).

## 2. Get the app

Install git if needed (<https://git-scm.com>; on macOS, running `git` once in Terminal offers to
install it), then in a terminal, in the folder where the app should live (for example `Documents`):

```bash
git clone https://github.com/marastefanic-cmd/bendaide "Rulebook Studio"
```

Use `git clone` rather than a ZIP download: that is what makes updates automatic later.

## 3. Start it

- **macOS**: double-click `start.command`. The first time, macOS may ask you to allow it
  (right-click → Open). If it says the file isn't executable, run `chmod +x start.command start.sh` once in Terminal.
- **Windows**: double-click `start.bat`.
- **Linux**: run `./start.sh`.

The first start installs the app's components (a minute or two; this also installs Claude
Code, so nothing else is needed). Then the browser opens at <http://localhost:5173>. The black
window that stays open is the app running; closing it stops the app.

## 4. First session: sign in

Open **Persistent instructions** and press **＋ Tell the AI what to change**, or add a game and
press **＋ New session**. A terminal with Claude Code appears. The first time, it will ask you to
sign in: type `/login`, press Enter, and follow the steps in the browser (a Claude Pro/Max
subscription or an Anthropic Console account both work). It stays signed in afterwards.

Prefer ChatGPT? Install Codex (`npm install -g @openai/codex`), then in **The app** choose
"Codex (ChatGPT)". Sign in inside Codex the same way.

## 5. Show them the three parts

1. **Persistent instructions** (purple) — rules the assistant follows in every game. Press
   **＋ Tell the AI what to change** and describe a rule in plain words.
2. **Games** — one folder per game. Upload the original rules and the translation, then press
   **＋ New session** and tell the assistant what to check. Each game also has its own instructions.
3. **The app** (blue) — which assistant to use, and **＋ Ask for a change in the app** to change the
   app itself by describing what you want. Changes appear live.

## Where the data lives

Everything the translator creates is in the `workspace/` folder next to the app:

```
workspace/global/               persistent instructions (every game)
workspace/projects/<game>/      one folder per game
  instructions/                   game-specific instructions
  context/                        original rules, translation, glossary, changelog, buglist
  output/                         files the assistant produced
  sessions/                       session metadata (the conversation itself is kept by Claude Code)
workspace/_sessions/            instruction-change and app-change sessions
workspace/settings.json         which assistant is used
```

Back up `workspace/` and you have everything.

## Troubleshooting

- **Bottom-left says "Terminal host down"** → close the app's black window and start it again.
- **The assistant window is empty or ended** → press **Start again** at the bottom of the window.
- **It asks to sign in again** → type `/login` in the assistant window.
- **Port already in use** → another copy is running; close the other black window.
- **Old `.doc` files** → save them as `.docx` first; `.docx` and `.xlsx` are converted automatically.
- **Something broke after "Ask for a change in the app"** → in the app folder run
  `git checkout -- .` (undoes uncommitted changes; only for a git checkout), then restart.
- **Updating**: automatic. Every start fetches the latest version from GitHub before launching
  (this needs the app to have been installed with `git clone`, not from a ZIP). If the assistant
  had changed the app locally and those changes clash with the update, the start window says so;
  the local changes are kept in `git stash list` and the app starts on the updated version.
