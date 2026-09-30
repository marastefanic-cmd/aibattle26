@echo off
setlocal
REM Windows: double-click this file to start Rulebook Studio.
REM Every start first fetches the latest version from GitHub (set SKIP_UPDATE=1 to skip).
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org ^(the LTS version^), then run this again.
  pause
  exit /b 1
)

set "NEED_INSTALL=0"
if not exist node_modules set "NEED_INSTALL=1"

REM ---------- automatic update ----------
if defined SKIP_UPDATE goto :run
where git >nul 2>nul
if errorlevel 1 goto :run
git rev-parse --git-dir >nul 2>nul
if errorlevel 1 goto :run

echo Checking for updates...
for /f "delims=" %%h in ('git rev-parse HEAD') do set "BEFORE=%%h"
set "STASHED=0"
for /f "delims=" %%s in ('git status --porcelain') do set "DIRTY=1"
if defined DIRTY (
  REM Local changes (e.g. made by the assistant in an app-change session) are parked, then restored.
  git stash push --include-untracked --quiet -m "local changes before update" && set "STASHED=1"
)
git pull --ff-only --quiet >nul 2>nul
if errorlevel 1 (
  echo Could not fetch updates ^(offline, or the repository has diverged^). Continuing with the current version.
)
if "%STASHED%"=="1" (
  git stash pop --quiet >nul 2>nul
  if errorlevel 1 (
    git checkout -- . >nul 2>nul
    git reset --hard HEAD --quiet >nul 2>nul
    echo Your local changes to the app conflicted with the update. They are kept safe in "git stash list";
    echo ask the assistant in "The app" to re-apply them. Continuing with the updated version.
  )
)
for /f "delims=" %%h in ('git rev-parse HEAD') do set "AFTER=%%h"
if not "%BEFORE%"=="%AFTER%" (
  echo Updated to the latest version.
  set "NEED_INSTALL=1"
)

:run
if "%NEED_INSTALL%"=="1" (
  echo Installing the app's components ^(this takes a minute^)...
  call npm install --no-audit --no-fund
)

echo Starting Rulebook Studio... your browser will open at http://localhost:5173
echo Keep this window open while you use the app. Close it to stop the app.
call npm start
pause
