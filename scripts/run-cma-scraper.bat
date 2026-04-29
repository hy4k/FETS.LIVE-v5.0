@echo off
REM CMA Prometric Seat Availability Scraper
REM Runs daily via Windows Task Scheduler
REM Logs output to scripts\cma-scraper.log

set PROJECT_DIR=%~dp0..
set LOG_FILE=%PROJECT_DIR%\scripts\cma-scraper.log

echo. >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"
echo %date% %time% - Starting CMA scraper >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"

cd /d "%PROJECT_DIR%"
node scripts\scrape-prometric.js >> "%LOG_FILE%" 2>&1

if %errorlevel% equ 0 (
    echo %date% %time% - Scraper completed successfully >> "%LOG_FILE%"
) else (
    echo %date% %time% - Scraper FAILED with exit code %errorlevel% >> "%LOG_FILE%"
)
