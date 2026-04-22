@echo off
setlocal
set "REPO_ROOT=C:\Dev\FETS.LIVE\5.0\FETS.LIVE-v5.0"
set "PLAYWRIGHT_BROWSERS_PATH=%REPO_ROOT%\.playwright-browsers"
set "NODE_EXE=c:\Users\mithu\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
set "LOG_FILE=%REPO_ROOT%\output\playwright\paragon-ingest-hourly.log"

cd /d "%REPO_ROOT%"
"%NODE_EXE%" "scripts\paragon-portal-ingest\run.mjs" >> "%LOG_FILE%" 2>&1
exit /b %ERRORLEVEL%
