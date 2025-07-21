@echo off
:: Set console code page to UTF-8
chcp 65001 > nul

echo Starting project build with npm run dist...

:: Optional: change to your project directory (uncomment and set the correct path)
:: cd C:\Path\To\Your\Project

:: Check if Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

:: Check if npm is installed
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    exit /b 1
)

:: Run the build command
npm run dist

:: Check if the build succeeded
if errorlevel 1 (
    echo [ERROR] Build failed.
) else (
    echo [SUCCESS] Build completed successfully.
)

pause
