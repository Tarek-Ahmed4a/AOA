@echo off
chcp 65001 >nul
setlocal EnableExtensions

title Anatomy Atlas 3D - Automatic Launcher
echo ========================================================================
echo   Anatomy Atlas 3D - Clinical Human Anatomy Platform
echo   اطلس التشريح البشري ثلاثي الابعاد - التشغيل والتحميل التلقائي
echo ========================================================================
echo.

set "RELEASE_URL=https://github.com/Tarek-Ahmed4a/AOA/releases/latest/download/AnatomyAtlas3D-Setup.exe"

:: 1. Launch immediately if installer, build, or installed app already exists locally
if exist "%~dp0AnatomyAtlas3D-Setup.exe" (
    echo [OK] Found installer in current folder. Launching AnatomyAtlas3D-Setup.exe...
    start "" "%~dp0AnatomyAtlas3D-Setup.exe"
    exit /b 0
)

if exist "%~dp0release\AnatomyAtlas3D-Setup.exe" (
    echo [OK] Found local build in release\. Launching AnatomyAtlas3D-Setup.exe...
    start "" "%~dp0release\AnatomyAtlas3D-Setup.exe"
    exit /b 0
)

if exist "%LOCALAPPDATA%\Programs\Anatomy Atlas 3D\Anatomy Atlas 3D.exe" (
    echo [OK] Anatomy Atlas 3D is already installed. Opening now...
    start "" "%LOCALAPPDATA%\Programs\Anatomy Atlas 3D\Anatomy Atlas 3D.exe"
    exit /b 0
)

if exist "%LOCALAPPDATA%\Programs\anatomy-atlas-3d\Anatomy Atlas 3D.exe" (
    echo [OK] Anatomy Atlas 3D is already installed. Opening now...
    start "" "%LOCALAPPDATA%\Programs\anatomy-atlas-3d\Anatomy Atlas 3D.exe"
    exit /b 0
)

if exist "%~dp0release\win-unpacked\Anatomy Atlas 3D.exe" (
    echo [OK] Found unpacked app in release\win-unpacked\. Launching...
    start "" "%~dp0release\win-unpacked\Anatomy Atlas 3D.exe"
    exit /b 0
)

if exist "%USERPROFILE%\Desktop\AnatomyAtlas3D-Setup.exe" (
    echo [OK] Found AnatomyAtlas3D-Setup.exe on Desktop. Launching...
    start "" "%USERPROFILE%\Desktop\AnatomyAtlas3D-Setup.exe"
    exit /b 0
)

if defined OneDrive (
    if exist "%OneDrive%\Desktop\AnatomyAtlas3D-Setup.exe" (
        echo [OK] Found AnatomyAtlas3D-Setup.exe on OneDrive Desktop. Launching...
        start "" "%OneDrive%\Desktop\AnatomyAtlas3D-Setup.exe"
        exit /b 0
    )
)

:: 2. If inside source folder with Node.js installed, assemble, build, and start locally
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    where npm >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        if exist "%~dp0package.json" (
            echo [DEV] Node.js detected. Preparing and launching Anatomy Atlas 3D locally...
            pushd "%~dp0"
            if not exist "node_modules" (
                echo Installing dependencies for first run...
                call npm install
                if errorlevel 1 (
                    popd
                    goto :download_fallback
                )
            ) else (
                if exist "scripts\reassembleLargeAssets.mjs" (
                    node scripts\reassembleLargeAssets.mjs
                )
            )
            if not exist "dist\index.html" (
                echo Building production Anatomy Atlas 3D bundle...
                call npm run build
                if errorlevel 1 (
                    popd
                    goto :download_fallback
                )
            )
            if exist "node_modules\.bin\electron.cmd" (
                echo Starting Desktop App...
                start "" cmd /c "npx --no-install electron ."
                popd
                exit /b 0
            )
            popd
        )
    )
)

:download_fallback
echo [DOWNLOAD] Downloading the 1-Click Installer (AnatomyAtlas3D-Setup.exe)...
echo [تحميل] جاري تحميل ملف التثبيت التلقائي على سطح المكتب، يرجى الانتظار...
echo URL: %RELEASE_URL%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $desktop=[Environment]::GetFolderPath('Desktop'); if(-not $desktop -or -not (Test-Path $desktop)){$desktop=Join-Path $env:USERPROFILE 'Desktop'}; $dest=Join-Path $desktop 'AnatomyAtlas3D-Setup.exe'; $url='%RELEASE_URL%'; Write-Host ('Saving to: ' + $dest) -ForegroundColor Cyan; try{ Import-Module BitsTransfer -ErrorAction Stop; Start-BitsTransfer -Source $url -Destination $dest -DisplayName 'Anatomy Atlas 3D' -Description 'Downloading AnatomyAtlas3D-Setup.exe...' } catch { Write-Host 'Using standard HTTPS transfer...' -ForegroundColor Yellow; Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing }; if(Test-Path $dest){ Write-Host '[DONE] Launching AnatomyAtlas3D-Setup.exe...' -ForegroundColor Green; Start-Process -FilePath $dest } else { throw 'Downloaded file missing' }"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Automatic download failed. Please check your internet connection or download manually:
    echo [خطأ] تعذر التحميل التلقائي. تأكد من اتصالك بالإنترنت أو حمل الملف مباشرة من:
    echo   https://github.com/Tarek-Ahmed4a/AOA/releases/latest
    echo.
    pause
    exit /b 1
)

exit /b 0
