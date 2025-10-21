@echo off
echo Starting Platypus Cron Monitor...
echo.

cd /d "%~dp0"

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist "..\\.env" (
    echo Error: .env file not found in parent directory
    echo Please ensure .env file exists with required configuration
    pause
    exit /b 1
)

echo Starting cron monitor with auto-restart...
echo Press Ctrl+C to stop
echo.

node start-monitor.js

pause