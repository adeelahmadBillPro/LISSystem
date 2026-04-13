#!/usr/bin/env python3
"""
LIS Multi-Tenant Client Deployment Script
==========================================
Usage:
  python scripts/new_client.py --name "City Lab" --slug citylab --plan monthly --port 8001
  python scripts/new_client.py --name "Medicare" --slug medicare --plan lifetime --port 8002
  python scripts/new_client.py --name "Alpha Lab" --slug alphalab --plan trial --port 8003

Plans:
  trial     → 14 days free, then prompts for payment
  monthly   → Rs. 5000/month subscription
  annual    → Rs. 50000/year subscription
  lifetime  → Rs. 150000 one-time full sale
"""

import argparse
import os
import sys
import json
import subprocess
import shutil
from datetime import datetime, timedelta
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
CLIENTS_DIR = ROOT / "clients"
DB_HOST = "localhost"
DB_PORT = 5432
DB_SUPERUSER = "postgres"
DB_PASSWORD = "AdeelAhmad@12345"   # your postgres superuser password
DOMAIN = "yourdomain.com"          # change this to your actual domain

PLAN_CONFIG = {
    "trial":    {"days": 14,   "price_pkr": 0,      "label": "14-Day Free Trial"},
    "monthly":  {"days": 30,   "price_pkr": 5000,   "label": "Monthly Rs. 5,000"},
    "annual":   {"days": 365,  "price_pkr": 50000,  "label": "Annual Rs. 50,000"},
    "lifetime": {"days": 36500,"price_pkr": 150000, "label": "Lifetime Rs. 150,000"},
}

# ── Colors ───────────────────────────────────────────────────────────────────
class C:
    GREEN  = '\033[92m'
    YELLOW = '\033[93m'
    RED    = '\033[91m'
    CYAN   = '\033[96m'
    BOLD   = '\033[1m'
    END    = '\033[0m'

def ok(msg):   print(f"  {C.GREEN}✓{C.END} {msg}")
def warn(msg): print(f"  {C.YELLOW}⚠{C.END} {msg}")
def err(msg):  print(f"  {C.RED}✗{C.END} {msg}"); sys.exit(1)
def step(msg): print(f"\n{C.CYAN}{C.BOLD}→ {msg}{C.END}")
def info(msg): print(f"    {msg}")

# ── Helpers ───────────────────────────────────────────────────────────────────
def run_psql(sql, db="postgres"):
    """Run a SQL command via psql."""
    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD
    result = subprocess.run(
        ["psql", "-h", DB_HOST, "-p", str(DB_PORT), "-U", DB_SUPERUSER, "-d", db, "-c", sql],
        capture_output=True, text=True, env=env
    )
    return result.returncode == 0, result.stdout, result.stderr

def db_exists(db_name):
    ok_flag, out, _ = run_psql(f"SELECT 1 FROM pg_database WHERE datname='{db_name}';")
    return "1 row" in out

def create_db(db_name, db_user, db_pass):
    """Create isolated DB + dedicated user for this client."""
    # Create user
    run_psql(f"CREATE USER {db_user} WITH PASSWORD '{db_pass}';")
    # Create DB owned by that user
    run_psql(f"CREATE DATABASE {db_name} OWNER {db_user};")
    # Grant all privileges
    run_psql(f"GRANT ALL PRIVILEGES ON DATABASE {db_name} TO {db_user};")
    ok(f"Database '{db_name}' + user '{db_user}' created")

def load_master_registry():
    registry_file = ROOT / "scripts" / "clients_registry.json"
    if registry_file.exists():
        return json.loads(registry_file.read_text())
    return {"clients": []}

def save_master_registry(data):
    registry_file = ROOT / "scripts" / "clients_registry.json"
    registry_file.write_text(json.dumps(data, indent=2, default=str))

# ── Main Deployment ───────────────────────────────────────────────────────────
def deploy_client(name, slug, plan, port, contact_phone="", contact_email=""):
    print(f"\n{C.BOLD}{C.CYAN}{'='*60}{C.END}")
    print(f"  LIS Client Deployment — {name}")
    print(f"{C.BOLD}{C.CYAN}{'='*60}{C.END}")

    if plan not in PLAN_CONFIG:
        err(f"Unknown plan '{plan}'. Use: trial, monthly, annual, lifetime")

    plan_info = PLAN_CONFIG[plan]
    db_name   = f"lis_{slug}"
    db_user   = f"lis_{slug}_user"
    db_pass   = f"Lis{slug.capitalize()}2026!"  # auto-generated strong password
    client_dir = CLIENTS_DIR / slug
    expires_at = datetime.now() + timedelta(days=plan_info["days"])

    # ── Step 1: Check for conflicts ──────────────────────────────────────────
    step("Checking for conflicts")
    registry = load_master_registry()
    existing = [c for c in registry["clients"] if c["slug"] == slug]
    if existing:
        warn(f"Client '{slug}' already exists. Update instead? (y/n)")
        if input("  > ").lower() != "y":
            sys.exit(0)
        registry["clients"] = [c for c in registry["clients"] if c["slug"] != slug]

    # ── Step 2: Create database ──────────────────────────────────────────────
    step("Setting up PostgreSQL database")
    if db_exists(db_name):
        warn(f"Database '{db_name}' already exists — skipping creation")
    else:
        create_db(db_name, db_user, db_pass)

    # ── Step 3: Create client directory ─────────────────────────────────────
    step("Creating client directory structure")
    client_dir.mkdir(parents=True, exist_ok=True)
    (client_dir / "logs").mkdir(exist_ok=True)
    (client_dir / "reports").mkdir(exist_ok=True)
    (client_dir / "backups").mkdir(exist_ok=True)
    ok(f"Directory: {client_dir}")

    # ── Step 4: Write .env file ──────────────────────────────────────────────
    step("Writing client configuration")
    db_url = f"postgresql+psycopg://{db_user}:{db_pass}@{DB_HOST}:{DB_PORT}/{db_name}"
    env_content = f"""# Auto-generated by LIS deploy script — {datetime.now().strftime('%Y-%m-%d %H:%M')}
DATABASE_URL={db_url}
SECRET_KEY=lis-{slug}-secret-{datetime.now().strftime('%Y%m%d')}-{port}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Lab Info
LAB_NAME={name}
LAB_PHONE={contact_phone or '+92-300-0000000'}
LAB_ADDRESS=Pakistan
LAB_EMAIL={contact_email or f'info@{slug}.pk'}

# License
LICENSE_PLAN={plan}
LICENSE_EXPIRES={expires_at.strftime('%Y-%m-%d')}
LICENSE_CLIENT={slug}

# Port
APP_PORT={port}

# WhatsApp (client sets their own key)
WA_API_KEY=
WA_API_URL=http://187.127.138.168/api/v1/messages/send

LOG_DIR={client_dir}/logs
REPORT_DIR={client_dir}/reports
"""
    (client_dir / ".env").write_text(env_content)
    ok(f".env written with DATABASE_URL and LICENSE info")

    # ── Step 5: Write license.json ───────────────────────────────────────────
    license_data = {
        "client_name": name,
        "slug": slug,
        "plan": plan,
        "plan_label": plan_info["label"],
        "price_pkr": plan_info["price_pkr"],
        "created_at": datetime.now().isoformat(),
        "expires_at": expires_at.isoformat(),
        "contact_phone": contact_phone,
        "contact_email": contact_email,
        "features": {
            "whatsapp": True,
            "machine_integration": True,
            "multi_branch": plan in ("annual", "lifetime"),
            "api_access": plan in ("annual", "lifetime"),
            "priority_support": plan in ("annual", "lifetime"),
        }
    }
    (client_dir / "license.json").write_text(json.dumps(license_data, indent=2, default=str))
    ok("license.json written")

    # ── Step 6: Run migrations + seed ────────────────────────────────────────
    step("Running database migrations and seeding admin user")
    env = os.environ.copy()
    env["DATABASE_URL"] = db_url
    env["LAB_NAME"] = name
    env["LICENSE_PLAN"] = plan
    env["LICENSE_EXPIRES"] = expires_at.strftime('%Y-%m-%d')

    # Run table creation
    result = subprocess.run(
        [sys.executable, "-c",
         "import sys; sys.path.insert(0,'.')\n"
         "from backend.database.models import create_tables; create_tables()\n"
         "print('Tables created')"],
        cwd=str(ROOT), env=env, capture_output=True, text=True
    )
    if result.returncode == 0:
        ok("Database tables created")
    else:
        warn(f"Migration warning: {result.stderr[:200]}")

    # Seed admin user
    admin_pass = f"Admin{slug.capitalize()}2026!"
    result = subprocess.run(
        [sys.executable, "-c", f"""
import sys; sys.path.insert(0,'.')
from backend.database.models import User
from backend.database.connection import SessionLocal
from backend.auth import hash_password
db = SessionLocal()
if not db.query(User).filter(User.username=='admin').first():
    db.add(User(username='admin', password_hash=hash_password('{admin_pass}'),
                full_name='System Administrator', role='admin', is_active=True))
    db.commit()
    print('Admin created')
else:
    print('Admin exists')
db.close()
"""],
        cwd=str(ROOT), env=env, capture_output=True, text=True
    )
    if "Admin" in result.stdout:
        ok(f"Admin user seeded — password: {admin_pass}")
    else:
        warn(f"Admin seed: {result.stdout} {result.stderr[:100]}")

    # ── Step 7: Write start script ───────────────────────────────────────────
    step("Writing startup scripts")

    # Windows batch file
    bat = f"""@echo off
cd /d {ROOT}
set DATABASE_URL={db_url}
set LAB_NAME={name}
set LICENSE_PLAN={plan}
set LICENSE_EXPIRES={expires_at.strftime('%Y-%m-%d')}
set APP_PORT={port}
uvicorn backend.main:app --host 0.0.0.0 --port {port} --reload
"""
    (client_dir / "start.bat").write_text(bat)

    # Linux systemd service file
    service = f"""[Unit]
Description=LIS Backend - {name}
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory={ROOT}
EnvironmentFile={client_dir}/.env
ExecStart=/usr/bin/uvicorn backend.main:app --host 0.0.0.0 --port {port}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    (client_dir / f"lis-{slug}.service").write_text(service)
    ok("start.bat (Windows) and .service (Linux) written")

    # ── Step 8: Nginx config ─────────────────────────────────────────────────
    nginx_conf = f"""server {{
    listen 80;
    server_name {slug}.{DOMAIN};

    # Frontend (React build)
    root /var/www/lis-{slug};
    index index.html;

    location / {{
        try_files $uri $uri/ /index.html;
    }}

    # API proxy
    location /api/ {{
        proxy_pass http://127.0.0.1:{port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300;
    }}
}}
"""
    (client_dir / f"nginx-{slug}.conf").write_text(nginx_conf)
    ok("Nginx config written")

    # ── Step 9: Register in master registry ──────────────────────────────────
    step("Registering in master client registry")
    registry["clients"].append({
        "slug": slug,
        "name": name,
        "plan": plan,
        "plan_label": plan_info["label"],
        "port": port,
        "db_name": db_name,
        "db_user": db_user,
        "db_pass": db_pass,
        "admin_password": admin_pass,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now().isoformat(),
        "contact_phone": contact_phone,
        "contact_email": contact_email,
        "subdomain": f"{slug}.{DOMAIN}",
        "status": "active",
    })
    save_master_registry(registry)
    ok("Registered in scripts/clients_registry.json")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{C.GREEN}{C.BOLD}{'='*60}")
    print(f"  ✅ CLIENT DEPLOYED SUCCESSFULLY!")
    print(f"{'='*60}{C.END}")
    print(f"""
  Client      : {C.BOLD}{name}{C.END}
  Slug        : {slug}
  Plan        : {C.YELLOW}{plan_info['label']}{C.END}
  Expires     : {expires_at.strftime('%Y-%m-%d')} ({plan_info['days']} days)
  Price       : Rs. {plan_info['price_pkr']:,}

  Database    : {db_name}
  DB User     : {db_user}
  DB Password : {db_pass}

  Admin Login : admin / {admin_pass}
  URL         : http://{slug}.{DOMAIN}
  Port        : {port}

  Files       : {client_dir}/
    .env           ← environment config
    license.json   ← license & plan info
    start.bat      ← Windows startup
    lis-{slug}.service ← Linux systemd
    nginx-{slug}.conf  ← Nginx config

  Next steps:
    Windows: run {client_dir}\\start.bat
    Linux:   sudo cp {client_dir}/lis-{slug}.service /etc/systemd/system/
             sudo systemctl enable lis-{slug}
             sudo systemctl start lis-{slug}
""")


# ── List clients ──────────────────────────────────────────────────────────────
def list_clients():
    registry = load_master_registry()
    clients = registry.get("clients", [])
    if not clients:
        print("No clients deployed yet.")
        return

    print(f"\n{'='*80}")
    print(f"  {'Client':<20} {'Plan':<12} {'Port':<8} {'Expires':<14} {'Status':<10}")
    print(f"{'='*80}")
    now = datetime.now()
    for c in clients:
        exp = datetime.fromisoformat(c["expires_at"])
        days_left = (exp - now).days
        status = c.get("status", "active")
        if days_left < 0:
            status = f"{C.RED}EXPIRED{C.END}"
        elif days_left <= 7:
            status = f"{C.YELLOW}⚠ {days_left}d left{C.END}"
        else:
            status = f"{C.GREEN}✓ active{C.END}"
        print(f"  {c['name']:<20} {c['plan']:<12} {c['port']:<8} {c['expires_at'][:10]:<14} {status}")
    print(f"{'='*80}")
    print(f"  Total: {len(clients)} clients\n")


# ── Backup client DB ──────────────────────────────────────────────────────────
def backup_client(slug):
    registry = load_master_registry()
    client = next((c for c in registry["clients"] if c["slug"] == slug), None)
    if not client:
        err(f"Client '{slug}' not found in registry")

    backup_dir = CLIENTS_DIR / slug / "backups"
    backup_dir.mkdir(exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = backup_dir / f"{client['db_name']}_{ts}.sql"

    env = os.environ.copy()
    env["PGPASSWORD"] = client["db_pass"]

    result = subprocess.run(
        ["pg_dump", "-h", DB_HOST, "-U", client["db_user"], client["db_name"],
         "-f", str(backup_file)],
        env=env, capture_output=True, text=True
    )
    if result.returncode == 0:
        size = backup_file.stat().st_size // 1024
        ok(f"Backup saved: {backup_file} ({size} KB)")
    else:
        err(f"pg_dump failed: {result.stderr}")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LIS Client Deployment Tool")
    subparsers = parser.add_subparsers(dest="command")

    # deploy command
    deploy_cmd = subparsers.add_parser("deploy", help="Deploy new client")
    deploy_cmd.add_argument("--name",    required=True,  help="Lab full name")
    deploy_cmd.add_argument("--slug",    required=True,  help="Short ID (no spaces): citylab")
    deploy_cmd.add_argument("--plan",    required=True,  choices=["trial","monthly","annual","lifetime"])
    deploy_cmd.add_argument("--port",    required=True,  type=int, help="Backend port: 8001")
    deploy_cmd.add_argument("--phone",   default="",     help="Contact phone")
    deploy_cmd.add_argument("--email",   default="",     help="Contact email")

    # list command
    subparsers.add_parser("list", help="List all clients")

    # backup command
    backup_cmd = subparsers.add_parser("backup", help="Backup a client's database")
    backup_cmd.add_argument("--slug", required=True, help="Client slug to backup")

    args = parser.parse_args()

    if args.command == "deploy":
        deploy_client(args.name, args.slug, args.plan, args.port, args.phone, args.email)
    elif args.command == "list":
        list_clients()
    elif args.command == "backup":
        backup_client(args.slug)
    else:
        parser.print_help()
