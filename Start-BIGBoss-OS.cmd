@echo off
REM Double-click launcher for the whole BIGBoss Trading Organization OS stack.
REM Starts Ollama, the FCC proxy, and the cockpit, then opens the dashboard.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-BIGBoss-OS.ps1"
