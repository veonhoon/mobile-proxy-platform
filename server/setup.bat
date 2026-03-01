@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   MobileProxy Server - Setup
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js found: %NODE_VER%

:: Install dependencies
echo.
echo [1/5] Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)
echo [OK] Dependencies installed

:: Generate .env file if not exists
echo.
echo [2/5] Configuring environment...
if not exist ".env" (
    :: Generate random JWT secret
    set "CHARS=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    set "JWT_SECRET="
    for /L %%i in (1,1,32) do (
        set /a "idx=!random! %% 62"
        for %%j in (!idx!) do set "JWT_SECRET=!JWT_SECRET!!CHARS:~%%j,1!"
    )
    (
        echo DATABASE_URL=file:./prisma/dev.db
        echo JWT_SECRET=!JWT_SECRET!
        echo PORT=3000
    ) > .env
    echo [OK] Created .env file
) else (
    echo [OK] .env file already exists, skipping
)

:: Generate Prisma client
echo.
echo [3/5] Generating Prisma client...
call npx prisma generate
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Prisma generate failed
    pause
    exit /b 1
)
echo [OK] Prisma client generated

:: Push database schema
echo.
echo [4/5] Setting up database...
call npx prisma db push
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Database setup failed
    pause
    exit /b 1
)
echo [OK] Database created

:: Seed database
echo.
echo [5/5] Seeding database...
call npx prisma db seed
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Database seeding failed
    pause
    exit /b 1
)
echo [OK] Database seeded

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo   Admin credentials:
echo     Email:    admin@admin.com
echo     Password: admin123
echo.
echo   To start the server, run: start.bat
echo   Dashboard: http://localhost:3000
echo.
pause
