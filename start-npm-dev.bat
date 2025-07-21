@echo off
cls
color 0A

echo ================================
echo       Starting npm start
echo ================================
echo.

:: Check if package.json exists
if not exist "package.json" (
    echo [ERROR] package.json not found in the current directory.
    pause
    exit /b
)

:: Run npm start
echo Running npm start ...
npm start

:: Wait for completion
echo.
echo ================================
echo       npm start finished
echo ================================
pause
