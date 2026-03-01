@echo off
setlocal

echo ============================================
echo   MobileProxy - Build APK
echo ============================================
echo.

:: Check if gradlew exists
if not exist "android\gradlew.bat" (
    echo [ERROR] Gradle wrapper not found in android/
    echo Please run: cd android ^&^& gradle wrapper --gradle-version 8.2
    pause
    exit /b 1
)

:: Build debug APK
echo [1/2] Building debug APK...
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% neq 0 (
    echo [ERROR] APK build failed
    cd ..
    pause
    exit /b 1
)
cd ..

:: Copy APK to server public directory
echo.
echo [2/2] Copying APK to server...
if not exist "server\public" mkdir server\public

:: Find and copy the debug APK
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "server\public\app.apk" >nul
    echo [OK] APK copied to server\public\app.apk
) else (
    echo [ERROR] APK not found at expected path
    echo Looking for APK in build outputs...
    dir /s /b android\app\build\outputs\apk\*.apk 2>nul
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Build Complete!
echo ============================================
echo.
echo   APK available at: server\public\app.apk
echo   Download URL: http://your-server:3000/download/app.apk
echo.
pause
