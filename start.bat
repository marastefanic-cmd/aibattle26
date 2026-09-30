@echo off
REM Windows: double-click to start Rulebook Studio with a visible log (for troubleshooting).
REM For everyday use, double-click "Rulebook Studio.vbs" (or the desktop shortcut it creates) instead.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org ^(the LTS version^), then run this again.
  pause
  exit /b 1
)

node scripts\launch.mjs
if errorlevel 1 pause
