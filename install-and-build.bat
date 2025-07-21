@echo off
setlocal

REM Step 1: Install npm dependencies
echo ================================
echo Starting: npm install
echo ================================
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] npm install failed with exit code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [OK] npm install completed successfully.
echo.

REM Step 2: Run build script
echo ================================
echo Starting: npm run dist
echo ================================
call npm run dist
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] npm run dist failed with exit code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [OK] Build completed successfully.
echo.
pause
