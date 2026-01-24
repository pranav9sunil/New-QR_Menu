@echo off
echo Starting Printer Bridge...
echo Please do not close this window while printing is active.
cd /d "%~dp0"
call npm start
pause
