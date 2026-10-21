@echo off
rem Double-click to build and open the Allhouse local alpha.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
if errorlevel 1 pause
