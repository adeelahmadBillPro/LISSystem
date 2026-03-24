"""
LIS Standalone — Simple Windows Desktop App
Reads from blood analyzer machine, matches patient, generates PDF report.

Usage:
  1. Add patients in the app
  2. Connect machine via serial port
  3. Machine sends results → auto-matched → PDF generated

Build EXE: pyinstaller --onefile --windowed --name "LIS-Reporter" app.py
"""

import os
import sys
import json
import sqlite3
import threading
import time
import configparser
from datetime import datetime, date
from tkinter import *
from tkinter import ttk, messagebox, filedialog

# --- Database ---
DB_PATH = "lab_data.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mrn TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            gender TEXT,
            dob TEXT,
            phone TEXT,
            address TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sample_id TEXT UNIQUE NOT NULL,
            patient_id INTEGER REFERENCES patients(id),
            test_panel TEXT,
            status TEXT DEFAULT 'pending',
            machine_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sample_id INTEGER REFERENCES samples(id),
            test_code TEXT,
            test_name TEXT,
            value TEXT,
            unit TEXT,
            ref_low REAL,
            ref_high REAL,
            flag TEXT DEFAULT 'N',
            received_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()

# --- Config ---
config = configparser.ConfigParser()
CONFIG_FILE = "config.ini"

def load_config():
    if os.path.exists(CONFIG_FILE):
        config.read(CONFIG_FILE)
    else:
        config['LAB'] = {'name': 'My Laboratory', 'phone': '', 'address': '', 'email': ''}
        config['DATABASE'] = {'path': 'lab_data.db'}
        config['MACHINE'] = {'port': 'COM3', 'baud_rate': '9600', 'protocol': 'auto'}
        config['REPORT'] = {'output_folder': 'reports', 'show_qr': 'yes', 'logo_path': ''}
        with open(CONFIG_FILE, 'w') as f:
            config.write(f)
    global DB_PATH
    DB_PATH = config.get('DATABASE', 'path', fallback='lab_data.db')

# --- HL7/ASTM Parser (simplified) ---
def parse_machine_data(raw_data):
    """Auto-detect and parse HL7 or ASTM message."""
    raw_data = raw_data.strip()

    if raw_data.startswith("MSH|"):
        return parse_hl7(raw_data)
    elif raw_data.startswith("H|") or raw_data.startswith("H\\"):
        return parse_astm(raw_data)
    else:
        return None

def parse_hl7(data):
    result = {"patient_id": "", "sample_id": "", "patient_name": "", "results": []}
    for line in data.split("\r"):
        if not line.strip():
            line_parts = data.split("\n")
            for l in line_parts:
                if l.strip():
                    line = l.strip()
                    break
        fields = line.split("|")
        seg = fields[0] if fields else ""

        if seg == "PID" and len(fields) > 5:
            result["patient_id"] = fields[3].split("^")[0] if len(fields) > 3 else ""
            name_parts = fields[5].split("^") if len(fields) > 5 else []
            result["patient_name"] = f"{name_parts[1]} {name_parts[0]}" if len(name_parts) > 1 else (name_parts[0] if name_parts else "")

        elif seg == "OBR" and len(fields) > 3:
            result["sample_id"] = fields[2].split("^")[0] if len(fields) > 2 else ""

        elif seg == "OBX" and len(fields) > 8:
            obs = fields[3].split("^") if len(fields) > 3 else []
            ref_range = fields[7] if len(fields) > 7 else ""
            ref_low, ref_high = None, None
            if "-" in ref_range:
                try:
                    parts = ref_range.split("-", 1)
                    ref_low = float(parts[0].strip())
                    ref_high = float(parts[1].strip())
                except: pass

            result["results"].append({
                "test_code": obs[0] if obs else "",
                "test_name": obs[1] if len(obs) > 1 else "",
                "value": fields[5] if len(fields) > 5 else "",
                "unit": fields[6] if len(fields) > 6 else "",
                "ref_low": ref_low,
                "ref_high": ref_high,
                "flag": fields[8].strip().upper() if len(fields) > 8 and fields[8].strip() else "N",
            })

    # Re-parse with newlines if carriage return parsing failed
    if not result["results"]:
        for line in data.split("\n"):
            fields = line.strip().split("|")
            seg = fields[0] if fields else ""

            if seg == "PID" and len(fields) > 5:
                result["patient_id"] = fields[3].split("^")[0] if len(fields) > 3 else ""
                name_parts = fields[5].split("^") if len(fields) > 5 else []
                result["patient_name"] = f"{name_parts[1]} {name_parts[0]}" if len(name_parts) > 1 else ""
            elif seg == "OBR" and len(fields) > 2:
                result["sample_id"] = fields[2].split("^")[0]
            elif seg == "OBX" and len(fields) > 8:
                obs = fields[3].split("^") if len(fields) > 3 else []
                ref_range = fields[7] if len(fields) > 7 else ""
                ref_low, ref_high = None, None
                if "-" in ref_range:
                    try:
                        parts = ref_range.split("-", 1)
                        ref_low = float(parts[0].strip())
                        ref_high = float(parts[1].strip())
                    except: pass

                result["results"].append({
                    "test_code": obs[0] if obs else "",
                    "test_name": obs[1] if len(obs) > 1 else "",
                    "value": fields[5] if len(fields) > 5 else "",
                    "unit": fields[6] if len(fields) > 6 else "",
                    "ref_low": ref_low, "ref_high": ref_high,
                    "flag": fields[8].strip().upper() if len(fields) > 8 and fields[8].strip() else "N",
                })

    return result

def parse_astm(data):
    result = {"patient_id": "", "sample_id": "", "patient_name": "", "results": []}
    for line in data.replace("\r", "\n").split("\n"):
        fields = line.strip().split("|")
        rec = fields[0].strip() if fields else ""

        if rec == "P" and len(fields) > 5:
            result["patient_id"] = fields[3].strip("^") if len(fields) > 3 else ""
            name_parts = fields[5].split("^") if len(fields) > 5 else []
            result["patient_name"] = f"{name_parts[1]} {name_parts[0]}" if len(name_parts) > 1 else ""
        elif rec == "O" and len(fields) > 2:
            result["sample_id"] = fields[2].strip("^")
        elif rec == "R" and len(fields) > 4:
            test_info = fields[2].split("^") if len(fields) > 2 else []
            ref_range = fields[5] if len(fields) > 5 else ""
            ref_low, ref_high = None, None
            if "-" in ref_range:
                try:
                    parts = ref_range.split("-", 1)
                    ref_low = float(parts[0].strip())
                    ref_high = float(parts[1].strip())
                except: pass

            result["results"].append({
                "test_code": test_info[3] if len(test_info) > 3 else (test_info[0] if test_info else ""),
                "test_name": test_info[4] if len(test_info) > 4 else "",
                "value": fields[3] if len(fields) > 3 else "",
                "unit": fields[4] if len(fields) > 4 else "",
                "ref_low": ref_low, "ref_high": ref_high,
                "flag": fields[6].strip().upper() if len(fields) > 6 and fields[6].strip() else "N",
            })
    return result


# --- PDF Report Generator ---
def generate_pdf(patient, sample_id, test_panel, results, output_path):
    """Generate a professional lab report PDF."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    doc = SimpleDocTemplate(output_path, pagesize=A4, topMargin=15*mm, bottomMargin=20*mm, leftMargin=15*mm, rightMargin=15*mm)
    styles = getSampleStyleSheet()
    elements = []

    lab_name = config.get('LAB', 'name', fallback='Laboratory')
    lab_address = config.get('LAB', 'address', fallback='')
    lab_phone = config.get('LAB', 'phone', fallback='')

    # Header
    elements.append(Paragraph(lab_name, ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, textColor=colors.Color(0.1,0.3,0.6), alignment=TA_CENTER)))
    elements.append(Paragraph(f"{lab_address}", ParagraphStyle('Sub', parent=styles['Normal'], fontSize=9, textColor=colors.grey, alignment=TA_CENTER)))
    elements.append(Paragraph(f"Phone: {lab_phone}", ParagraphStyle('Sub2', parent=styles['Normal'], fontSize=9, textColor=colors.grey, alignment=TA_CENTER)))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.Color(0.1,0.3,0.6), spaceAfter=3*mm, spaceBefore=2*mm))

    elements.append(Paragraph(f"<b>{test_panel or 'Laboratory Report'}</b>", ParagraphStyle('Panel', parent=styles['Normal'], fontSize=13, alignment=TA_CENTER, textColor=colors.Color(0.1,0.3,0.6), spaceAfter=4*mm)))

    # Patient Info
    age = ""
    if patient['dob']:
        try:
            dob = datetime.strptime(patient['dob'], "%Y-%m-%d").date()
            age = str((date.today() - dob).days // 365)
        except: pass

    gender = {"M": "Male", "F": "Female"}.get(patient.get('gender', ''), patient.get('gender', ''))

    info_data = [
        [f"Patient: <b>{patient['name']}</b>", f"Age/Gender: <b>{age} yrs / {gender}</b>"],
        [f"MRN: <b>{patient['mrn']}</b>", f"Sample ID: <b>{sample_id}</b>"],
        [f"Phone: <b>{patient.get('phone', '')}</b>", f"Date: <b>{datetime.now().strftime('%d-%b-%Y %I:%M %p')}</b>"],
    ]

    for row in info_data:
        t = Table([[Paragraph(row[0], styles['Normal']), Paragraph(row[1], styles['Normal'])]], colWidths=[90*mm, 90*mm])
        t.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('BOTTOMPADDING', (0,0), (-1,-1), 2)]))
        elements.append(t)

    elements.append(Spacer(1, 4*mm))

    # Results Table
    header_style = ParagraphStyle('TH', parent=styles['Normal'], fontSize=9, textColor=colors.white, fontName='Helvetica-Bold')
    table_data = [[
        Paragraph("Test Name", header_style),
        Paragraph("Result", header_style),
        Paragraph("Unit", header_style),
        Paragraph("Reference Range", header_style),
        Paragraph("Flag", header_style),
    ]]

    for r in results:
        flag = r.get('flag', 'N')
        flag_color = colors.red if flag in ('H', 'HH') else colors.blue if flag in ('L', 'LL') else colors.black
        flag_label = {'H': 'HIGH', 'L': 'LOW', 'HH': 'CRIT HIGH', 'LL': 'CRIT LOW'}.get(flag, 'Normal')

        ref = f"{r['ref_low']} - {r['ref_high']}" if r.get('ref_low') is not None else "-"

        row_style = ParagraphStyle('Row', parent=styles['Normal'], fontSize=9)
        val_style = ParagraphStyle('Val', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold', textColor=flag_color)

        table_data.append([
            Paragraph(r.get('test_name', ''), row_style),
            Paragraph(str(r.get('value', '')), val_style),
            Paragraph(r.get('unit', ''), row_style),
            Paragraph(ref, row_style),
            Paragraph(flag_label, ParagraphStyle('Flag', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold', textColor=flag_color, alignment=TA_CENTER)),
        ])

    col_widths = [60*mm, 30*mm, 25*mm, 40*mm, 20*mm]
    results_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    table_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.Color(0.1,0.3,0.6)),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LINEBELOW', (0,0), (-1,0), 1, colors.Color(0.1,0.3,0.6)),
        ('LINEBELOW', (0,-1), (-1,-1), 1, colors.Color(0.1,0.3,0.6)),
    ]
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            table_style.append(('BACKGROUND', (0,i), (-1,i), colors.Color(0.95,0.95,0.98)))

    results_table.setStyle(TableStyle(table_style))
    elements.append(results_table)

    # Signature
    elements.append(Spacer(1, 20*mm))
    sig = Table([
        ["_________________________", "_________________________"],
        ["Lab Technician", "Pathologist"],
    ], colWidths=[90*mm, 90*mm])
    sig.setStyle(TableStyle([('ALIGN', (0,0), (0,-1), 'LEFT'), ('ALIGN', (1,0), (1,-1), 'RIGHT'), ('FONTSIZE', (0,0), (-1,-1), 9), ('TEXTCOLOR', (0,0), (-1,-1), colors.grey)]))
    elements.append(sig)

    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph("This report is generated electronically. Please consult your physician.", ParagraphStyle('Disc', parent=styles['Normal'], fontSize=7, textColor=colors.grey, alignment=TA_CENTER)))

    doc.build(elements)
    return output_path


# --- Main GUI Application ---
class LISApp:
    def __init__(self, root):
        self.root = root
        self.root.title("LIS Reporter — Lab Report Generator")
        self.root.geometry("1000x650")
        self.root.configure(bg="#f0f2f5")

        self.listener_running = False

        # Style
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('Title.TLabel', font=('Segoe UI', 16, 'bold'), background='#f0f2f5')
        style.configure('Card.TFrame', background='white', relief='solid', borderwidth=1)

        self.create_menu()
        self.create_tabs()

    def create_menu(self):
        menubar = Menu(self.root)
        file_menu = Menu(menubar, tearoff=0)
        file_menu.add_command(label="Settings", command=self.show_settings)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.root.quit)
        menubar.add_cascade(label="File", menu=file_menu)

        help_menu = Menu(menubar, tearoff=0)
        help_menu.add_command(label="About", command=lambda: messagebox.showinfo("About", "LIS Reporter v1.0\nLab Report Generator\n\nConnects to blood analyzer machines\nand generates professional PDF reports."))
        menubar.add_cascade(label="Help", menu=help_menu)

        self.root.config(menu=menubar)

    def create_tabs(self):
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill=BOTH, expand=True, padx=10, pady=10)

        # Tab 1: Patients
        self.patients_tab = ttk.Frame(notebook)
        notebook.add(self.patients_tab, text="  Patients  ")
        self.create_patients_tab()

        # Tab 2: Samples & Results
        self.samples_tab = ttk.Frame(notebook)
        notebook.add(self.samples_tab, text="  Samples & Results  ")
        self.create_samples_tab()

        # Tab 3: Machine Listener
        self.machine_tab = ttk.Frame(notebook)
        notebook.add(self.machine_tab, text="  Machine Listener  ")
        self.create_machine_tab()

        # Tab 4: Manual Entry
        self.manual_tab = ttk.Frame(notebook)
        notebook.add(self.manual_tab, text="  Manual Entry  ")
        self.create_manual_tab()

    def create_patients_tab(self):
        frame = self.patients_tab

        # Add patient form
        form = ttk.LabelFrame(frame, text="Add Patient", padding=10)
        form.pack(fill=X, padx=10, pady=5)

        fields = [("MRN:", "mrn"), ("Name:", "name"), ("Gender (M/F):", "gender"), ("DOB (YYYY-MM-DD):", "dob"), ("Phone:", "phone")]
        self.patient_vars = {}

        for i, (label, key) in enumerate(fields):
            ttk.Label(form, text=label).grid(row=0, column=i*2, padx=5, sticky=W)
            var = StringVar()
            ttk.Entry(form, textvariable=var, width=15).grid(row=0, column=i*2+1, padx=5)
            self.patient_vars[key] = var

        ttk.Button(form, text="Add Patient", command=self.add_patient).grid(row=0, column=10, padx=10)

        # Patient list
        list_frame = ttk.Frame(frame)
        list_frame.pack(fill=BOTH, expand=True, padx=10, pady=5)

        cols = ("MRN", "Name", "Gender", "DOB", "Phone")
        self.patient_tree = ttk.Treeview(list_frame, columns=cols, show="headings", height=15)
        for col in cols:
            self.patient_tree.heading(col, text=col)
            self.patient_tree.column(col, width=120)

        scrollbar = ttk.Scrollbar(list_frame, orient=VERTICAL, command=self.patient_tree.yview)
        self.patient_tree.configure(yscrollcommand=scrollbar.set)
        self.patient_tree.pack(side=LEFT, fill=BOTH, expand=True)
        scrollbar.pack(side=RIGHT, fill=Y)

        self.refresh_patients()

    def add_patient(self):
        mrn = self.patient_vars['mrn'].get().strip()
        name = self.patient_vars['name'].get().strip()
        if not mrn or not name:
            messagebox.showwarning("Error", "MRN and Name are required")
            return

        conn = get_db()
        try:
            conn.execute("INSERT INTO patients (mrn, name, gender, dob, phone) VALUES (?, ?, ?, ?, ?)",
                (mrn, name, self.patient_vars['gender'].get().strip().upper(),
                 self.patient_vars['dob'].get().strip(), self.patient_vars['phone'].get().strip()))
            conn.commit()
            for var in self.patient_vars.values():
                var.set("")
            self.refresh_patients()
            messagebox.showinfo("Success", f"Patient {name} added")
        except sqlite3.IntegrityError:
            messagebox.showerror("Error", f"MRN {mrn} already exists")
        finally:
            conn.close()

    def refresh_patients(self):
        for item in self.patient_tree.get_children():
            self.patient_tree.delete(item)
        conn = get_db()
        for row in conn.execute("SELECT mrn, name, gender, dob, phone FROM patients ORDER BY id DESC"):
            self.patient_tree.insert("", END, values=tuple(row))
        conn.close()

    def create_samples_tab(self):
        frame = self.samples_tab

        # Sample list with results
        cols = ("Sample ID", "Patient", "Test Panel", "Status", "Results", "Date")
        self.sample_tree = ttk.Treeview(frame, columns=cols, show="headings", height=15)
        for col in cols:
            self.sample_tree.heading(col, text=col)
        self.sample_tree.column("Sample ID", width=100)
        self.sample_tree.column("Patient", width=150)
        self.sample_tree.column("Test Panel", width=120)
        self.sample_tree.column("Status", width=80)
        self.sample_tree.column("Results", width=80)
        self.sample_tree.column("Date", width=150)
        self.sample_tree.pack(fill=BOTH, expand=True, padx=10, pady=5)

        btn_frame = ttk.Frame(frame)
        btn_frame.pack(fill=X, padx=10, pady=5)
        ttk.Button(btn_frame, text="Generate PDF Report", command=self.generate_report).pack(side=LEFT, padx=5)
        ttk.Button(btn_frame, text="Refresh", command=self.refresh_samples).pack(side=LEFT, padx=5)
        ttk.Button(btn_frame, text="Open Reports Folder", command=lambda: os.startfile(config.get('REPORT', 'output_folder', fallback='reports'))).pack(side=LEFT, padx=5)

        self.refresh_samples()

    def refresh_samples(self):
        for item in self.sample_tree.get_children():
            self.sample_tree.delete(item)
        conn = get_db()
        rows = conn.execute("""
            SELECT s.sample_id, p.name, s.test_panel, s.status,
                   (SELECT COUNT(*) FROM results r WHERE r.sample_id = s.id), s.created_at
            FROM samples s LEFT JOIN patients p ON s.patient_id = p.id
            ORDER BY s.id DESC
        """).fetchall()
        for row in rows:
            self.sample_tree.insert("", END, values=tuple(row))
        conn.close()

    def generate_report(self):
        selected = self.sample_tree.selection()
        if not selected:
            messagebox.showwarning("Error", "Select a sample first")
            return

        sample_id = self.sample_tree.item(selected[0])['values'][0]
        conn = get_db()

        sample = conn.execute("SELECT * FROM samples WHERE sample_id = ?", (sample_id,)).fetchone()
        if not sample:
            messagebox.showerror("Error", "Sample not found")
            return

        patient = conn.execute("SELECT * FROM patients WHERE id = ?", (sample['patient_id'],)).fetchone()
        results = conn.execute("SELECT * FROM results WHERE sample_id = ?", (sample['id'],)).fetchall()
        conn.close()

        if not results:
            messagebox.showwarning("Error", "No results for this sample")
            return

        output_folder = config.get('REPORT', 'output_folder', fallback='reports')
        os.makedirs(output_folder, exist_ok=True)
        output_path = os.path.join(output_folder, f"report_{sample_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")

        patient_dict = dict(patient)
        results_list = [dict(r) for r in results]

        try:
            generate_pdf(patient_dict, sample_id, sample['test_panel'], results_list, output_path)
            messagebox.showinfo("Success", f"Report saved:\n{output_path}")
            os.startfile(output_path)
        except Exception as e:
            messagebox.showerror("Error", f"Report generation failed:\n{str(e)}")

    def create_machine_tab(self):
        frame = self.machine_tab

        # Machine list
        machines_frame = ttk.LabelFrame(frame, text="Connected Machines", padding=10)
        machines_frame.pack(fill=X, padx=10, pady=5)

        self.machine_configs = []
        self.machine_status = []
        self.machine_threads = {}

        for i in range(1, 6):
            section = f"MACHINE_{i}"
            if config.has_section(section):
                name = config.get(section, 'name', fallback=f'Machine {i}')
                port = config.get(section, 'port', fallback=f'COM{i+2}')
                baud = config.get(section, 'baud_rate', fallback='9600')
                enabled = config.get(section, 'enabled', fallback='no').lower() == 'yes'

                row = i - 1
                ttk.Label(machines_frame, text=f"{name}:", font=("Segoe UI", 9, "bold")).grid(row=row, column=0, padx=5, sticky=W)

                port_var = StringVar(value=port)
                ttk.Entry(machines_frame, textvariable=port_var, width=8).grid(row=row, column=1, padx=3)

                baud_var = StringVar(value=baud)
                ttk.Entry(machines_frame, textvariable=baud_var, width=8).grid(row=row, column=2, padx=3)

                status_label = ttk.Label(machines_frame, text="Stopped", foreground="red", width=12)
                status_label.grid(row=row, column=3, padx=5)

                btn = ttk.Button(machines_frame, text="Start",
                    command=lambda n=name, p=port_var, b=baud_var, s=status_label, bt=None, idx=i: self.toggle_machine(idx, n, p, b, s))
                btn.grid(row=row, column=4, padx=5)

                self.machine_configs.append({
                    'index': i, 'name': name, 'port_var': port_var, 'baud_var': baud_var,
                    'status_label': status_label, 'button': btn, 'enabled': enabled,
                })

        ttk.Button(machines_frame, text="Start All Enabled", command=self.start_all_machines).grid(row=5, column=0, columnspan=2, padx=5, pady=5)
        ttk.Button(machines_frame, text="Stop All", command=self.stop_all_machines).grid(row=5, column=2, columnspan=2, padx=5, pady=5)

        # Log
        log_frame = ttk.LabelFrame(frame, text="Machine Log", padding=5)
        log_frame.pack(fill=BOTH, expand=True, padx=10, pady=5)

        self.log_text = Text(log_frame, height=15, font=("Consolas", 9), bg="#1e1e1e", fg="#00ff00")
        self.log_text.pack(fill=BOTH, expand=True)
        self.log("LIS Reporter ready. Connect machines and click 'Start'.")

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert(END, f"[{timestamp}] {message}\n")
        self.log_text.see(END)

    def toggle_machine(self, idx, name, port_var, baud_var, status_label):
        if idx in self.machine_threads and self.machine_threads[idx].get('running'):
            # Stop
            self.machine_threads[idx]['running'] = False
            status_label.config(text="Stopped", foreground="red")
            self.log(f"[{name}] Stopped")
        else:
            # Start
            self.machine_threads[idx] = {'running': True}
            status_label.config(text="Listening...", foreground="green")
            port = port_var.get()
            baud = int(baud_var.get())
            self.log(f"[{name}] Listening on {port} at {baud} baud...")

            thread = threading.Thread(
                target=self.serial_listener,
                args=(idx, name, port, baud, status_label),
                daemon=True,
            )
            thread.start()

    def start_all_machines(self):
        for mc in self.machine_configs:
            if mc['enabled'] and (mc['index'] not in self.machine_threads or not self.machine_threads[mc['index']].get('running')):
                self.toggle_machine(mc['index'], mc['name'], mc['port_var'], mc['baud_var'], mc['status_label'])

    def stop_all_machines(self):
        for idx in list(self.machine_threads.keys()):
            if self.machine_threads[idx].get('running'):
                self.machine_threads[idx]['running'] = False
        for mc in self.machine_configs:
            mc['status_label'].config(text="Stopped", foreground="red")
        self.log("All machines stopped.")

    def serial_listener(self, idx, name, port, baud, status_label):
        try:
            import serial
            ser = serial.Serial(port=port, baudrate=baud, timeout=1)
            self.root.after(0, self.log, f"[{name}] Connected to {port}")

            buffer = b""
            while self.machine_threads.get(idx, {}).get('running', False):
                try:
                    if ser.in_waiting > 0:
                        data = ser.read(ser.in_waiting)
                        buffer += data

                        if b"\x1c\r" in buffer or (b"MSH|" in buffer and buffer.endswith(b"\r")):
                            message = buffer.decode("ascii", errors="replace").strip("\x0b\x1c\r\n")
                            if message:
                                self.root.after(0, self.process_message, message)
                                self.root.after(0, self.log, f"[{name}] Message received ({len(message)} bytes)")
                            buffer = b""
                    else:
                        time.sleep(0.1)
                except Exception as e:
                    self.root.after(0, self.log, f"[{name}] Read error: {str(e)}")
                    time.sleep(2)

            ser.close()
            self.root.after(0, self.log, f"[{name}] Disconnected")
        except ImportError:
            self.root.after(0, self.log, f"[{name}] ERROR: pyserial not installed")
        except Exception as e:
            self.root.after(0, self.log, f"[{name}] ERROR: {str(e)}")
            self.root.after(0, lambda: status_label.config(text="Error", foreground="red"))

    def process_message(self, raw_message):
        self.log(f"Received message ({len(raw_message)} bytes)")

        parsed = parse_machine_data(raw_message)
        if not parsed or not parsed.get("results"):
            self.log("ERROR: Could not parse message")
            return

        self.log(f"Parsed: Patient={parsed['patient_id']}, Sample={parsed['sample_id']}, Results={len(parsed['results'])}")

        conn = get_db()

        # Find or create sample
        sample = conn.execute("SELECT * FROM samples WHERE sample_id = ?", (parsed['sample_id'],)).fetchone()
        if not sample:
            # Find patient by ID in local DB
            patient = conn.execute("SELECT * FROM patients WHERE mrn = ?", (parsed['patient_id'],)).fetchone()

            # If not found locally, try client's external database
            if not patient and config.has_section('CLIENT_DB') and config.get('CLIENT_DB', 'enabled', fallback='no').lower() == 'yes':
                self.log(f"Patient {parsed['patient_id']} not in local DB. Checking client database...")
                try:
                    from db_connector import sync_patients_from_client_db
                    sync_patients_from_client_db(config, DB_PATH)
                    patient = conn.execute("SELECT * FROM patients WHERE mrn = ?", (parsed['patient_id'],)).fetchone()
                    if patient:
                        self.log(f"Found patient in client DB: {patient['name']}")
                        self.refresh_patients()
                except Exception as e:
                    self.log(f"Client DB lookup failed: {str(e)}")

            if patient:
                conn.execute("INSERT INTO samples (sample_id, patient_id, status, machine_id) VALUES (?, ?, 'completed', 'AUTO')",
                    (parsed['sample_id'], patient['id']))
                conn.commit()
                sample = conn.execute("SELECT * FROM samples WHERE sample_id = ?", (parsed['sample_id'],)).fetchone()
                self.log(f"Auto-created sample {parsed['sample_id']} for patient {patient['name']}")
            else:
                self.log(f"WARNING: Patient {parsed['patient_id']} not found in database. Register patient first.")
                conn.close()
                return

        # Save results
        for r in parsed['results']:
            conn.execute(
                "INSERT INTO results (sample_id, test_code, test_name, value, unit, ref_low, ref_high, flag) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (sample['id'], r['test_code'], r['test_name'], r['value'], r['unit'], r.get('ref_low'), r.get('ref_high'), r.get('flag', 'N'))
            )

        conn.execute("UPDATE samples SET status = 'completed' WHERE id = ?", (sample['id'],))
        conn.commit()
        conn.close()

        self.log(f"Saved {len(parsed['results'])} results for sample {parsed['sample_id']}")
        self.refresh_samples()

        # Auto-generate report
        messagebox.showinfo("Results Received", f"Results received for sample {parsed['sample_id']}!\n{len(parsed['results'])} tests.\n\nClick OK to generate PDF report.")
        self.generate_report_auto(parsed['sample_id'])

    def generate_report_auto(self, sample_id):
        conn = get_db()
        sample = conn.execute("SELECT * FROM samples WHERE sample_id = ?", (sample_id,)).fetchone()
        patient = conn.execute("SELECT * FROM patients WHERE id = ?", (sample['patient_id'],)).fetchone()
        results = conn.execute("SELECT * FROM results WHERE sample_id = ?", (sample['id'],)).fetchall()
        conn.close()

        output_folder = config.get('REPORT', 'output_folder', fallback='reports')
        os.makedirs(output_folder, exist_ok=True)
        output_path = os.path.join(output_folder, f"report_{sample_id}.pdf")

        try:
            generate_pdf(dict(patient), sample_id, sample['test_panel'] or "Lab Report", [dict(r) for r in results], output_path)
            self.log(f"PDF report generated: {output_path}")
            os.startfile(output_path)
        except Exception as e:
            self.log(f"Report error: {str(e)}")

    def create_manual_tab(self):
        frame = self.manual_tab

        # Sample ID + Patient selection
        top = ttk.LabelFrame(frame, text="Sample Information", padding=10)
        top.pack(fill=X, padx=10, pady=5)

        ttk.Label(top, text="Sample ID:").grid(row=0, column=0, padx=5)
        self.manual_sample = StringVar()
        ttk.Entry(top, textvariable=self.manual_sample, width=15).grid(row=0, column=1, padx=5)

        ttk.Label(top, text="Patient MRN:").grid(row=0, column=2, padx=5)
        self.manual_patient = StringVar()
        ttk.Entry(top, textvariable=self.manual_patient, width=15).grid(row=0, column=3, padx=5)

        ttk.Label(top, text="Test Panel:").grid(row=0, column=4, padx=5)
        self.manual_panel = StringVar()
        ttk.Combobox(top, textvariable=self.manual_panel, values=["CBC", "LFT", "RFT", "Lipid Profile", "Thyroid", "Blood Sugar"], width=15).grid(row=0, column=5, padx=5)

        # Results entry
        results_frame = ttk.LabelFrame(frame, text="Enter Results", padding=5)
        results_frame.pack(fill=BOTH, expand=True, padx=10, pady=5)

        cols = ("Test Code", "Test Name", "Value", "Unit", "Ref Low", "Ref High")
        self.manual_tree = ttk.Treeview(results_frame, columns=cols, show="headings", height=10)
        for col in cols:
            self.manual_tree.heading(col, text=col)
            self.manual_tree.column(col, width=120)
        self.manual_tree.pack(fill=BOTH, expand=True)

        entry_frame = ttk.Frame(results_frame)
        entry_frame.pack(fill=X, pady=5)

        self.manual_vars = {}
        for i, col in enumerate(cols):
            ttk.Label(entry_frame, text=f"{col}:").grid(row=0, column=i*2, padx=2)
            var = StringVar()
            ttk.Entry(entry_frame, textvariable=var, width=12).grid(row=0, column=i*2+1, padx=2)
            self.manual_vars[col] = var

        ttk.Button(entry_frame, text="Add Row", command=self.add_manual_row).grid(row=0, column=12, padx=10)

        # Buttons
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(fill=X, padx=10, pady=5)
        ttk.Button(btn_frame, text="Save & Generate Report", command=self.save_manual_results).pack(side=LEFT, padx=5)
        ttk.Button(btn_frame, text="Clear All", command=lambda: [self.manual_tree.delete(i) for i in self.manual_tree.get_children()]).pack(side=LEFT, padx=5)

    def add_manual_row(self):
        values = tuple(self.manual_vars[col].get() for col in ("Test Code", "Test Name", "Value", "Unit", "Ref Low", "Ref High"))
        if not values[0] or not values[2]:
            messagebox.showwarning("Error", "Test Code and Value are required")
            return
        self.manual_tree.insert("", END, values=values)
        for var in self.manual_vars.values():
            var.set("")

    def save_manual_results(self):
        sample_id = self.manual_sample.get().strip()
        patient_mrn = self.manual_patient.get().strip()

        if not sample_id or not patient_mrn:
            messagebox.showwarning("Error", "Sample ID and Patient MRN are required")
            return

        rows = self.manual_tree.get_children()
        if not rows:
            messagebox.showwarning("Error", "Add at least one result")
            return

        conn = get_db()
        patient = conn.execute("SELECT * FROM patients WHERE mrn = ?", (patient_mrn,)).fetchone()
        if not patient:
            messagebox.showerror("Error", f"Patient {patient_mrn} not found. Add patient first.")
            conn.close()
            return

        # Create sample
        try:
            conn.execute("INSERT INTO samples (sample_id, patient_id, test_panel, status) VALUES (?, ?, ?, 'completed')",
                (sample_id, patient['id'], self.manual_panel.get()))
            conn.commit()
        except sqlite3.IntegrityError:
            pass  # Sample already exists

        sample = conn.execute("SELECT * FROM samples WHERE sample_id = ?", (sample_id,)).fetchone()

        # Save results
        for item in rows:
            vals = self.manual_tree.item(item)['values']
            ref_low = float(vals[4]) if vals[4] else None
            ref_high = float(vals[5]) if vals[5] else None

            # Auto-flag
            flag = "N"
            try:
                val = float(vals[2])
                if ref_high and val > ref_high: flag = "H"
                elif ref_low and val < ref_low: flag = "L"
            except: pass

            conn.execute("INSERT INTO results (sample_id, test_code, test_name, value, unit, ref_low, ref_high, flag) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (sample['id'], vals[0], vals[1], vals[2], vals[3], ref_low, ref_high, flag))

        conn.commit()
        conn.close()

        self.refresh_samples()
        self.generate_report_auto(sample_id)

    def sync_client_db(self):
        """Sync patients from client's existing database."""
        try:
            from db_connector import sync_patients_from_client_db, test_connection

            # Test connection first
            ok, msg = test_connection(config)
            if not ok:
                self.log(f"Client DB: {msg}")
                return

            # Sync patients
            count, message = sync_patients_from_client_db(config, DB_PATH)
            self.log(f"Client DB Sync: {message}")
            if count > 0:
                self.refresh_patients()
        except ImportError as e:
            self.log(f"Client DB: Missing driver — {str(e)}")
        except Exception as e:
            self.log(f"Client DB Error: {str(e)}")

    def auto_sync_loop(self):
        """Auto-sync from client DB at configured interval."""
        if config.has_section('CLIENT_DB') and config.get('CLIENT_DB', 'enabled', fallback='no').lower() == 'yes':
            interval = int(config.get('CLIENT_DB', 'sync_interval', fallback='5'))
            if interval > 0:
                self.sync_client_db()
                self.root.after(interval * 60 * 1000, self.auto_sync_loop)

    def show_settings(self):
        win = Toplevel(self.root)
        win.title("Settings")
        win.geometry("400x300")

        ttk.Label(win, text="Lab Name:").grid(row=0, column=0, padx=10, pady=5, sticky=W)
        name_var = StringVar(value=config.get('LAB', 'name', fallback=''))
        ttk.Entry(win, textvariable=name_var, width=30).grid(row=0, column=1, padx=10, pady=5)

        ttk.Label(win, text="Phone:").grid(row=1, column=0, padx=10, pady=5, sticky=W)
        phone_var = StringVar(value=config.get('LAB', 'phone', fallback=''))
        ttk.Entry(win, textvariable=phone_var, width=30).grid(row=1, column=1, padx=10, pady=5)

        ttk.Label(win, text="Address:").grid(row=2, column=0, padx=10, pady=5, sticky=W)
        addr_var = StringVar(value=config.get('LAB', 'address', fallback=''))
        ttk.Entry(win, textvariable=addr_var, width=30).grid(row=2, column=1, padx=10, pady=5)

        def save():
            config['LAB']['name'] = name_var.get()
            config['LAB']['phone'] = phone_var.get()
            config['LAB']['address'] = addr_var.get()
            with open(CONFIG_FILE, 'w') as f:
                config.write(f)
            messagebox.showinfo("Saved", "Settings saved!")
            win.destroy()

        ttk.Button(win, text="Save", command=save).grid(row=5, column=1, padx=10, pady=20)


# --- License Check on Startup ---
def check_license_gui():
    """Show license activation dialog if not licensed."""
    from license_manager import verify_license, get_machine_id

    result = verify_license()

    if result["valid"]:
        return True, result

    # Show activation window
    activation = Tk()
    activation.title("LIS Reporter — Activation Required")
    activation.geometry("500x350")
    activation.configure(bg="#f0f2f5")
    activation.resizable(False, False)

    Label(activation, text="LIS Reporter", font=("Segoe UI", 18, "bold"), bg="#f0f2f5").pack(pady=(20, 5))
    Label(activation, text="License Activation Required", font=("Segoe UI", 11), bg="#f0f2f5", fg="#666").pack()

    Label(activation, text="Your Machine ID:", font=("Segoe UI", 9), bg="#f0f2f5", fg="#888").pack(pady=(20, 2))

    machine_id = get_machine_id()
    mid_entry = Entry(activation, font=("Consolas", 14), justify=CENTER, width=25, fg="#2563eb")
    mid_entry.insert(0, machine_id)
    mid_entry.configure(state="readonly")
    mid_entry.pack(pady=5)

    Label(activation, text="Send this Machine ID to your vendor to get a license file.",
          font=("Segoe UI", 9), bg="#f0f2f5", fg="#666").pack(pady=5)

    Label(activation, text=result.get("error", ""), font=("Segoe UI", 9), bg="#f0f2f5", fg="red",
          wraplength=400).pack(pady=5)

    def copy_id():
        activation.clipboard_clear()
        activation.clipboard_append(machine_id)
        copy_btn.configure(text="Copied!")

    def browse_license():
        from tkinter import filedialog
        filepath = filedialog.askopenfilename(
            title="Select license.json file",
            filetypes=[("License files", "*.json"), ("All files", "*.*")]
        )
        if filepath:
            import shutil
            shutil.copy2(filepath, "license.json")
            result2 = verify_license()
            if result2["valid"]:
                messagebox.showinfo("Activated!", f"License activated for: {result2['lab_name']}\nExpiry: {result2['expiry']}")
                activation.destroy()
            else:
                messagebox.showerror("Invalid", result2.get("error", "Invalid license"))

    btn_frame = Frame(activation, bg="#f0f2f5")
    btn_frame.pack(pady=15)

    copy_btn = Button(btn_frame, text="Copy Machine ID", command=copy_id,
                      bg="#2563eb", fg="white", font=("Segoe UI", 10), padx=15, pady=5, relief=FLAT, cursor="hand2")
    copy_btn.pack(side=LEFT, padx=5)

    Button(btn_frame, text="Load License File", command=browse_license,
           bg="#16a34a", fg="white", font=("Segoe UI", 10), padx=15, pady=5, relief=FLAT, cursor="hand2").pack(side=LEFT, padx=5)

    Button(btn_frame, text="Exit", command=activation.destroy,
           bg="#dc2626", fg="white", font=("Segoe UI", 10), padx=15, pady=5, relief=FLAT, cursor="hand2").pack(side=LEFT, padx=5)

    activated = [False]

    def on_close():
        activation.destroy()

    activation.protocol("WM_DELETE_WINDOW", on_close)
    activation.mainloop()

    # Re-check after activation window closes
    result = verify_license()
    return result["valid"], result


# --- Main ---
if __name__ == "__main__":
    load_config()
    init_db()

    # Check license
    licensed, license_info = check_license_gui()

    if not licensed:
        sys.exit(0)

    root = Tk()
    lab_name = license_info.get("lab_name", config.get("LAB", "name", fallback="Laboratory"))
    root.title(f"LIS Reporter — {lab_name}")
    app = LISApp(root)

    # Auto-start machine listeners if enabled in config
    if config.get('APP', 'auto_start_listeners', fallback='no').lower() == 'yes':
        root.after(1000, app.start_all_machines)

    # Auto-sync from client's database
    root.after(2000, app.auto_sync_loop)

    root.mainloop()
