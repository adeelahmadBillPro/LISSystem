# LIS Reporter — Standalone EXE Version

Simple Windows desktop application for labs that only need:
- Machine connection (serial port)
- Patient management
- Auto report generation (PDF)

## How to Build EXE

```bash
cd standalone
pip install pyinstaller pyserial reportlab
pyinstaller --onefile --windowed --name "LIS-Reporter" app.py
```

The EXE will be in `standalone/dist/LIS-Reporter.exe`

## What to Give the Client

Copy these 2 files to client's computer:
1. `LIS-Reporter.exe`
2. `config.ini` (edit lab name, phone, address)

That's it! No Python, no database, no server needed.

## How Client Uses It

1. Double-click `LIS-Reporter.exe`
2. Add patients in the Patients tab
3. Connect machine cable (RS-232 to USB)
4. Go to Machine Listener tab → set COM port → Start Listening
5. Machine sends results → auto-parsed → PDF report generated
6. OR use Manual Entry tab to type results manually

## Features
- HL7 v2.x and ASTM E1381 parsing
- Auto patient matching by MRN/Sample ID
- Professional PDF reports with color-coded flags
- SQLite database (no server needed)
- Configurable lab name, phone, address
- Serial port listener with auto-reconnect
- Manual result entry with auto-flag H/L/N
