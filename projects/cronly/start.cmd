@echo off
setlocal
cd /d "%~dp0"
title Cronly Playground Local Server

rem === locate node even if it is NOT on PATH (e.g. WorkBuddy-managed node) ===
rem NOTE: deliberately NO "goto" inside ( ) blocks -- cmd mis-resolves labels there.
set "NODE_BIN="
where node >nul 2>nul
if not errorlevel 1 set "NODE_BIN=node"
if not defined NODE_BIN if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_BIN=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_BIN if exist "C:\Program Files\nodejs\node.exe" set "NODE_BIN=C:\Program Files\nodejs\node.exe"
if not defined NODE_BIN if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_BIN=C:\Program Files (x86)\nodejs\node.exe"
for /d %%V in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do ( if not defined NODE_BIN if exist "%%V\node.exe" set "NODE_BIN=%%V\node.exe" )

if not defined NODE_BIN (
  echo.
  echo   [X] Node.js not found. Install Node 18+: https://nodejs.org/
  echo.
  pause & exit /b 1
)

set "PORT=%PORT%"
if "%PORT%"=="" set "PORT=4173"

rem pick the first available serve script
set "SERVE_SCRIPT="
if exist server.js set "SERVE_SCRIPT=server.js"
if not defined SERVE_SCRIPT if exist serve.js set "SERVE_SCRIPT=serve.js"
if not defined SERVE_SCRIPT if exist playground/serve.js set "SERVE_SCRIPT=playground/serve.js"

if defined SERVE_SCRIPT (
  rem open browser a few seconds after the server should be up (avoids race)
  start "" /min cmd /c "ping -n 4 127.0.0.1 >nul & start "" http://localhost:%PORT%/"
  "%NODE_BIN%" %SERVE_SCRIPT%
) else (
  start "" /min cmd /c "ping -n 4 127.0.0.1 >nul & start "" http://localhost:%PORT%/"
  npx --yes serve . -l %PORT%
)
