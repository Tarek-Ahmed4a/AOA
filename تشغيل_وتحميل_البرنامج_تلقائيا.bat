@echo off
chcp 65001 >nul
setlocal EnableExtensions

title تشغيل وتحميل أطلس التشريح البشري ثلاثي الأبعاد
echo ========================================================================
echo   أطلس التشريح البشري ثلاثي الأبعاد - التشغيل والتحميل التلقائي
echo   Anatomy Atlas 3D - Automatic 1-Click Launcher
echo ========================================================================
echo.

if exist "%~dp0Run_Anatomy_Atlas_3D.bat" (
    call "%~dp0Run_Anatomy_Atlas_3D.bat"
    exit /b %ERRORLEVEL%
)

set "RELEASE_URL=https://github.com/Tarek-Ahmed4a/AOA/releases/latest/download/AnatomyAtlas3D-Setup.exe"

if exist "%~dp0AnatomyAtlas3D-Setup.exe" (
    start "" "%~dp0AnatomyAtlas3D-Setup.exe"
    exit /b 0
)

if exist "%LOCALAPPDATA%\Programs\Anatomy Atlas 3D\Anatomy Atlas 3D.exe" (
    start "" "%LOCALAPPDATA%\Programs\Anatomy Atlas 3D\Anatomy Atlas 3D.exe"
    exit /b 0
)

echo جاري تحميل ملف التثبيت التلقائي على سطح المكتب، يرجى الانتظار...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $desktop=[Environment]::GetFolderPath('Desktop'); if(-not $desktop -or -not (Test-Path $desktop)){$desktop=Join-Path $env:USERPROFILE 'Desktop'}; $dest=Join-Path $desktop 'AnatomyAtlas3D-Setup.exe'; $url='%RELEASE_URL%'; try{ Import-Module BitsTransfer -ErrorAction Stop; Start-BitsTransfer -Source $url -Destination $dest -DisplayName 'Anatomy Atlas 3D' -Description 'Downloading AnatomyAtlas3D-Setup.exe...' } catch { Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing }; Start-Process -FilePath $dest"

if %ERRORLEVEL% NEQ 0 (
    echo تعذر التحميل التلقائي. يرجى التحميل من: https://github.com/Tarek-Ahmed4a/AOA/releases/latest
    pause
    exit /b 1
)

exit /b 0
