@echo off
REM Install dependencies from package.json using npm

echo Starting npm dependency installation...
npm install

IF %ERRORLEVEL% NEQ 0 (
    echo Error occurred during npm installation.
    pause
    exit /b %ERRORLEVEL%
)

echo Installation completed successfully.
pause
