# Setting up Rulebook Studio

For whoever installs the app on the translator's computer (a friend, or an AI assistant helping
them). About five minutes. Afterwards the translator only ever double-clicks one icon.

## 1. Install Node.js

Install the **LTS** version from <https://nodejs.org>. Next, next, finish. Nothing else is needed:
Claude Code is installed together with the app.

## 2. Get the app

Either download the repository as a ZIP from GitHub and unzip it somewhere permanent (for example
`Documents\Rulebook Studio`), or, if git is installed, clone it (this also turns on automatic
updates):

```bash
git clone https://github.com/marastefanic-cmd/bendaide "Rulebook Studio"
```

## 3. Start it

- **Windows**: double-click **`Rulebook Studio.vbs`**. The first start opens a small window that
  installs the app's components (a minute or two), then the app opens in its own window and a
  **Rulebook Studio** shortcut with a dice icon appears on the desktop. From then on, use the shortcut.
  (`start.bat` does the same with a visible log, for troubleshooting.)
- **macOS**: double-click **`start.command`**. The first time, macOS may ask you to allow it
  (right-click → Open). It installs, starts, opens the app window, and you can close the Terminal
  window that appeared. If it says the file isn't executable, run `chmod +x start.command start.sh` once in Terminal.
- **Linux**: `./start.sh`.

The app opens as its own window if Chrome, Edge or Brave is installed (no address bar, own taskbar
icon); otherwise it opens as a tab in the default browser at <http://localhost:5173>.

Closing the window does **not** stop the app; it keeps running in the background and the icon
reopens it instantly. **Quit** in the bottom-left corner of the app stops it completely.

## 4. First session: sign in

Open **Persistent instructions** and press **＋ Tell the AI what to change**, or add a game and
press **＋ New session**. A terminal with Claude Code appears. The first time, it asks to pick a
colour theme (press Enter) and to sign in: choose **Claude account with subscription** and follow
the browser (a Claude Pro/Max subscription or an Anthropic Console account both work). It stays
signed in afterwards; `/login` in a session signs in again if ever needed.

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

Back up `workspace/` and you have everything. Closing or quitting the app never deletes anything.

## Updates

If the app was installed with `git clone`, every start fetches the latest version first. If the
assistant had changed the app locally and those changes clash with the update, the start log says
so; the local changes are kept in `git stash list` and the app starts on the updated version. A ZIP
install never updates itself (replace the folder with a new ZIP, keeping `workspace/`).

## Troubleshooting

- **Nothing happens on double-click** → run `start.bat` (Windows) or `./start.sh` to see the log;
  it is also written to `.run/app.log` in the app folder.
- **Bottom-left says "Terminal host down"** → Quit, then start again.
- **The assistant window is empty or ended** → press **Start again** at the bottom of the window.
- **It asks to sign in again** → type `/login` in the assistant window.
- **Old `.doc` files** → save them as `.docx` first; `.docx` and `.xlsx` are converted automatically.
- **Something broke after "Ask for a change in the app"** → in the app folder run
  `git checkout -- .` (undoes uncommitted changes; only for a git checkout), then start again.
