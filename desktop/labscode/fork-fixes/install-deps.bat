@echo off
rem LabsCode: one-time setup of dev tools (Chocolatey, Node.js, Python, Rust, Git, Claude Code).
rem Must run as Administrator. Skips each tool that already works, however it was installed.
setlocal EnableExtensions
net session >nul 2>&1
if errorlevel 1 (
	echo Requesting administrator rights...
	rem The path goes through an environment variable so a quote in a folder name cannot break the command.
	set "SELF=%~f0"
	powershell -NoProfile -Command "Start-Process -FilePath $env:SELF -Verb RunAs"
	exit /b
)

where choco >nul 2>&1
if errorlevel 1 (
	echo Installing Chocolatey...
	powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = 3072; iex ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
	set "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
)

call :ensure "node --version" nodejs-lts "Node.js"
rem "python" can be the Microsoft Store shortcut, which exists but exits with 9009, so running it is the real test.
call :ensure "python -V" python "Python"
call :ensure "git --version" git "Git"
call :ensure "rustup --version" rustup.install "Rust"

if exist "%ALLUSERSPROFILE%\chocolatey\bin\RefreshEnv.cmd" call "%ALLUSERSPROFILE%\chocolatey\bin\RefreshEnv.cmd"
where claude >nul 2>&1
if errorlevel 1 (
	where npm >nul 2>&1
	if errorlevel 1 (
		echo Skipping Claude Code CLI: npm is not on PATH yet. Run this again after restarting.
	) else (
		echo Installing Claude Code CLI...
		call npm install -g @anthropic-ai/claude-code
	)
) else (
	echo Claude Code CLI is already installed.
)

echo.
echo Done. Restart LabsCode so it sees the new tools.
pause
exit /b 0

:ensure
%~1 >nul 2>&1
if errorlevel 1 (
	echo Installing %~3...
	choco install %~2 -y --no-progress
) else (
	echo %~3 is already installed.
)
exit /b 0
