@echo off
rem OmniTool desktop edition: checks for Node.js, installs what is missing into this folder, then starts the app.
rem Nothing is installed system-wide and no administrator rights are needed.
rem   start.bat                  normal start
rem   start.bat --skip-labscode  start without downloading LabsCode (the LabsCode tab can do it later)
rem   start.bat --no-launch      prepare everything but do not open the window (used by the self-test)
rem   start.bat --dev            also allow Ctrl+Shift+I developer tools
setlocal EnableExtensions EnableDelayedExpansion
title OmniTool
cd /d "%~dp0"

set "DESKTOP=%~dp0"
set "RUNTIME=%DESKTOP%runtime"
set "APPDIR=%DESKTOP%app"
set "NODE_VERSION=24.21.0"
set "NODE_DIST=node-v%NODE_VERSION%-win-x64"
rem Keep npm's and Electron's download caches inside the OmniTool folder too.
set "npm_config_cache=%RUNTIME%\npm-cache"
set "npm_config_update_notifier=false"
set "npm_config_fund=false"
set "npm_config_audit=false"
set "electron_config_cache=%RUNTIME%\electron-cache"
set "NO_LAUNCH="
for %%A in (%*) do if /i "%%~A"=="--no-launch" set "NO_LAUNCH=1"

echo.
echo   OmniTool desktop edition
echo.

if /i not "%PROCESSOR_ARCHITECTURE%"=="AMD64" if /i not "%PROCESSOR_ARCHITEW6432%"=="AMD64" (
	echo   OmniTool's desktop edition needs 64-bit Windows 10 or 11 on an x64 PC.
	echo   This PC reports "%PROCESSOR_ARCHITECTURE%". Use the web edition instead: open web\index.html.
	goto :fail
)

rem ---- 1. Node.js 18 or newer -------------------------------------------------
set "NODE_EXE="
set "NODE_MAJOR="
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%v"
if defined NODE_MAJOR if !NODE_MAJOR! GEQ 18 (
	set "NODE_EXE=node"
	echo   [1/4] Using the Node.js already installed ^(version !NODE_MAJOR!^).
)
if not defined NODE_EXE if exist "%RUNTIME%\node\node.exe" (
	set "NODE_EXE=%RUNTIME%\node\node.exe"
	set "PATH=%RUNTIME%\node;%PATH%"
	echo   [1/4] Using OmniTool's own copy of Node.js in desktop\runtime\node.
)
if not defined NODE_EXE (
	if defined NODE_MAJOR (echo   [1/4] Node.js !NODE_MAJOR! is too old; OmniTool needs 18 or newer.) else (echo   [1/4] Node.js was not found.)
	echo         Downloading a private copy, Node.js %NODE_VERSION% ^(about 35 MB^), into desktop\runtime\node.
	call :get_node || goto :fail_node
	set "NODE_EXE=%RUNTIME%\node\node.exe"
	set "PATH=%RUNTIME%\node;%PATH%"
)

rem ---- 2. Electron and koffi (into desktop\app\node_modules) -----------------
set "NEED_INSTALL="
if not exist "%APPDIR%\node_modules\electron\package.json" set "NEED_INSTALL=1"
if not exist "%APPDIR%\node_modules\koffi\package.json" set "NEED_INSTALL=1"
if defined NEED_INSTALL (
	echo   [2/4] Installing OmniTool's packages ^(Electron and koffi^) into desktop\app\node_modules.
	pushd "%APPDIR%"
	if exist package-lock.json (call npm ci --loglevel=error) else (call npm install --loglevel=error)
	set "NPM_EXIT=!errorlevel!"
	popd
	if not "!NPM_EXIT!"=="0" goto :fail_npm
) else (
	echo   [2/4] Packages are already installed.
)
"%NODE_EXE%" "%APPDIR%\node_modules\electron\install.js"
if errorlevel 1 goto :fail_electron
if not exist "%APPDIR%\node_modules\electron\dist\electron.exe" goto :fail_electron

rem ---- 3. LabsCode -------------------------------------------------------------
echo   [3/4] Checking LabsCode.
"%NODE_EXE%" "%APPDIR%\setup.js" %*
set "SETUP_EXIT=%errorlevel%"
if "%SETUP_EXIT%"=="2" echo         Continuing without LabsCode for now.
if not "%SETUP_EXIT%"=="0" if not "%SETUP_EXIT%"=="2" echo         LabsCode setup stopped unexpectedly ^(code %SETUP_EXIT%^). Continuing without it.

rem ---- 4. Start -------------------------------------------------------------------
if defined NO_LAUNCH (
	echo   [4/4] Ready. Not starting the window because of --no-launch.
	exit /b 0
)
echo   [4/4] Starting OmniTool.
start "" "%APPDIR%\node_modules\electron\dist\electron.exe" "%APPDIR%" %*
exit /b 0

rem ---- Helpers -------------------------------------------------------------------
:get_node
if not exist "%RUNTIME%" mkdir "%RUNTIME%"
set "ZIP=%RUNTIME%\%NODE_DIST%.zip"
set "SUMS=%RUNTIME%\SHASUMS256.txt"
set "BASE=https://nodejs.org/dist/v%NODE_VERSION%"
where curl.exe >nul 2>nul
if not errorlevel 1 (
	curl.exe -fL --retry 3 --progress-bar -o "%ZIP%" "%BASE%/%NODE_DIST%.zip" || exit /b 1
	curl.exe -fsSL --retry 3 -o "%SUMS%" "%BASE%/SHASUMS256.txt" || exit /b 1
) else (
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -UseBasicParsing '%BASE%/%NODE_DIST%.zip' -OutFile '%ZIP%'; Invoke-WebRequest -UseBasicParsing '%BASE%/SHASUMS256.txt' -OutFile '%SUMS%'" || exit /b 1
)
rem Compare the download with the checksum nodejs.org publishes before using it.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$want = (Select-String -Path '%SUMS%' -Pattern '%NODE_DIST%.zip').Line.Split(' ')[0]; $got = (Get-FileHash -Algorithm SHA256 '%ZIP%').Hash.ToLower(); if ($want -ne $got) { Write-Host '        Checksum mismatch: the download is damaged or was altered.'; exit 1 }" || exit /b 1
if exist "%RUNTIME%\%NODE_DIST%" rmdir /s /q "%RUNTIME%\%NODE_DIST%"
tar.exe -xf "%ZIP%" -C "%RUNTIME%" 2>nul
if errorlevel 1 powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%RUNTIME%' -Force" || exit /b 1
if exist "%RUNTIME%\node" rmdir /s /q "%RUNTIME%\node"
move "%RUNTIME%\%NODE_DIST%" "%RUNTIME%\node" >nul || exit /b 1
del "%ZIP%" "%SUMS%" >nul 2>nul
if not exist "%RUNTIME%\node\node.exe" exit /b 1
echo         Node.js %NODE_VERSION% is ready.
exit /b 0

:fail_node
echo.
echo   Could not download Node.js from nodejs.org.
echo   Check your internet connection and run start.bat again.
echo   Or install Node.js 18 or newer yourself from https://nodejs.org (the LTS version), then run start.bat.
goto :fail

:fail_npm
echo.
echo   npm could not install OmniTool's packages.
echo   Check your internet connection, then run start.bat again.
echo   If it keeps failing, delete the folder desktop\app\node_modules and try once more.
goto :fail

:fail_electron
echo.
echo   The Electron runtime (about 160 MB from github.com/electron) did not download completely.
echo   Check your internet connection, then run start.bat again; the download resumes from the cache.
goto :fail

:fail
echo.
echo   Nothing was installed outside the OmniTool folder.
echo   The web edition needs no setup: open web\index.html in your browser.
echo.
pause
exit /b 1
