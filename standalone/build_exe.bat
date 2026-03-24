@echo off
echo ===================================
echo Building LIS Reporter EXE
echo ===================================

REM Install dependencies
pip install pyinstaller pyserial reportlab

REM Build EXE
pyinstaller --onefile --windowed --name "LIS-Reporter" --icon=icon.ico app.py

echo.
echo ===================================
echo EXE built: dist\LIS-Reporter.exe
echo ===================================
echo.
echo To distribute to client, copy:
echo   1. dist\LIS-Reporter.exe
echo   2. config.ini
echo.
echo That is all the client needs!
pause
