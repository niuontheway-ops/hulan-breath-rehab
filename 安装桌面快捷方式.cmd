@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\desktop\install-shortcut.ps1"
if errorlevel 1 pause
