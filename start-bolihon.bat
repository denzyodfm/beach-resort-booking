@echo off
title BOLIHON booking
rem pushd, not cd: it also works when this folder is on a network share.
pushd "%~dp0"

rem Port 3030: 3000 is cibi-credit-scoring, 3010 fuel-monitoring, 3020 HRMS.
set "BOLIHON_PORT=3030"

rem Prefer the server's shared runtime when it is there; otherwise use the Node on PATH.
if exist "%~dp0..\runtime\node-v22.23.3-win-x64\node.exe" set "PATH=%~dp0..\runtime\node-v22.23.3-win-x64;%PATH%"
where node >nul 2>nul || (echo Node.js 22 is required: https://nodejs.org & pause & exit /b 1)

if not exist .env.local (
  copy .env.example .env.local >nul
  echo Created .env.local - set DATABASE_URL and AUTH_SECRET, then run this file again.
  notepad .env.local
  exit /b 0
)

if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm ci || (pause & exit /b 1)
)

rem NEXT_PUBLIC_ settings are baked in at build time. After copying new code or changing
rem .env.local, delete the .next folder so the next start rebuilds.
if not exist .next\BUILD_ID (
  echo Building, this takes a few minutes...
  call npm run build || (pause & exit /b 1)
)

call npm start -- -p %BOLIHON_PORT%
pause
