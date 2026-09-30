#!/usr/bin/env bash
# Starts Rulebook Studio (macOS / Linux). Double-click start.command on a Mac, or run ./start.sh
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (the LTS version), then run this again."
  read -r -p "Press Enter to close." _
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First start: installing the app's components (this takes a minute)…"
  npm install
fi

echo "Starting Rulebook Studio… your browser will open at http://localhost:5173"
echo "Keep this window open while you use the app. Close it to stop the app."
npm start
