#!/usr/bin/env bash
# Starts Rulebook Studio (macOS / Linux). Double-click start.command on a Mac, or run ./start.sh
# Everything happens in scripts/launch.mjs: update, install, start in the background, open the window.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (the LTS version), then run this again."
  read -r -p "Press Enter to close." _
  exit 1
fi

node scripts/launch.mjs
status=$?
if [ $status -ne 0 ]; then read -r -p "Press Enter to close." _; fi
exit $status
