# Setting up Rulebook Studio

This is for whoever installs the app on the translator's computer (a friend, or an AI assistant
helping them). It takes about five minutes. After this, the translator only ever double-clicks
one file to start the app.

## 1. Install Node.js

Install the **LTS** version from <https://nodejs.org>. Nothing else is needed.

## 2. Get the app

Either download this repository as a ZIP from GitHub and unzip it somewhere permanent
(for example `Documents/Rulebook Studio`), or:

```bash
git clone <this repository's URL> "Rulebook Studio"
```

## 3. Start it

- **macOS**: double-click `start.command`. The first time, macOS may ask you to allow it
  (right-click → Open). If it says the file isn't executable, run `chmod +x start.command start.sh` once in Terminal.
- **Windows**: double-click `start.bat`.
- **Linux**: run `./start.sh`.

The first start installs the app's components (a minute or two). Then the browser opens at
<http://localhost:5173>. The black window that stays open is the app running; closing it stops the app.

## 4. Connect Claude

The app asks for this on first launch. Pick **"I have a Claude subscription"** (Claude Pro or Max),
sign in in the browser, copy the code it shows, paste it into the app. Done — it stays connected.

If the translator has an Anthropic API key instead, pick "I have an API key" and paste it.

Either way, credentials are stored only on that computer (Claude login in the Claude config folder,
an API key in `workspace/.local/`). They are never committed to git.

## 5. Show them the three parts

1. **Persistent instructions** (purple) — rules the AI follows in every game. Click the big
   **＋ Tell the AI what to change** button and describe a rule in plain words.
2. **Games** — one folder per game. Upload the original rules and the translation, then open
   **＋ New session** and tell the AI what to check. Each game also has its own instructions.
3. **The app** (blue) — the Claude connection, and **＋ Ask for a change in the app** to change
   the app itself by describing what you want. Changes appear live.

## Updating the app later

If you keep it as a git checkout: `git pull` then restart. If the AI has modified the app locally
(via "Ask for a change in the app"), those changes live in the same folder — commit them or keep
them, your choice.

## Where the data lives

Everything the translator creates is in the `workspace/` folder next to the app:

```
workspace/global/               persistent instructions (every game)
workspace/projects/<game>/      one folder per game
  instructions/                   game-specific instructions
  context/                        original rules, translation, glossary, changelog, buglist
  output/                         files the AI produced
  sessions/                       chat transcripts
workspace/_sessions/            transcripts of instruction-change and app-change sessions
workspace/.local/               saved API key (if used)
```

Back up `workspace/` and you have everything.

## Troubleshooting

- **"Not connected" in the bottom-left** → open *The app* → Connect.
- **Port already in use** → another copy is running; close the other black window.
- **The AI says it can't read a Word file** → re-upload it; Word (.docx) and Excel files are
  converted to text on upload. Old `.doc` files must be saved as `.docx` first.
- **Something broke after "Ask for a change in the app"** → in the app folder run
  `git checkout -- .` to undo uncommitted changes (only if the app is a git checkout), then restart.
