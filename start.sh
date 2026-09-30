#!/usr/bin/env bash
# Starts Rulebook Studio (macOS / Linux). Double-click start.command on a Mac, or run ./start.sh
# Every start first fetches the latest version from GitHub (set SKIP_UPDATE=1 to skip).
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (the LTS version), then run this again."
  read -r -p "Press Enter to close." _
  exit 1
fi

# ---------- automatic update ----------
if [ -z "$SKIP_UPDATE" ] && command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Checking for updates…"
  before=$(git rev-parse HEAD)
  stashed=0
  if [ -n "$(git status --porcelain)" ]; then
    # Local changes (e.g. made by the assistant in an app-change session) are parked, then restored.
    git stash push --include-untracked --quiet -m "local changes before update $(date +%F_%T)" && stashed=1
  fi
  if git pull --ff-only --quiet 2>/dev/null; then
    after=$(git rev-parse HEAD)
    [ "$before" != "$after" ] && echo "Updated to the latest version."
  else
    echo "Could not fetch updates (offline, or the repository has diverged). Continuing with the current version."
  fi
  if [ "$stashed" = 1 ]; then
    if git stash pop --quiet; then
      :
    else
      git checkout -- . 2>/dev/null || true
      git reset --hard HEAD --quiet
      echo "Your local changes to the app conflicted with the update. They are kept safe in 'git stash list';"
      echo "ask the assistant in 'The app' to re-apply them. Continuing with the updated version."
    fi
  fi
  if [ "$before" != "$(git rev-parse HEAD)" ] || [ ! -d node_modules ]; then
    echo "Installing the app's components…"
    npm install --no-audit --no-fund
  fi
elif [ ! -d node_modules ]; then
  echo "First start: installing the app's components (this takes a minute)…"
  npm install --no-audit --no-fund
fi

echo "Starting Rulebook Studio… your browser will open at http://localhost:5173"
echo "Keep this window open while you use the app. Close it to stop the app."
npm start
