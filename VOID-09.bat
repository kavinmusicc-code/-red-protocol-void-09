@echo off
title VOID-09 DESKTOP APP
cd /d "%~dp0"

where npm >nul 2>nul
if %errorlevel%==0 (
  if not exist "node_modules\electron" (
    echo Installing VOID-09 Desktop runtime...
    npm install
  )
  start "" cmd /c "npm start"
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:4173/"
  python -m http.server 4173 --bind 127.0.0.1
  goto :eof
)

start "" "%~dp0index.html"