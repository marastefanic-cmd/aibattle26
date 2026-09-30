@echo off
REM Windows: double-click this file to start Rulebook Studio.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org ^(the LTS version^), then run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First start: installing the app's components ^(this takes a minute^)...
  call npm install
)

echo Starting Rulebook Studio... your browser will open at http://localhost:5173
echo Keep this window open while you use the app. Close it to stop the app.
call npm start
pause
