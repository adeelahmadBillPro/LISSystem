"""
External Database Connector — reads patient data from client's existing database.

Supports:
- MySQL (hospital systems, HMS)
- PostgreSQL
- SQL Server / MSSQL (most common in Pakistan hospitals)
- SQLite (simple file-based)
- MS Access (.mdb, .accdb)

The app reads patient data from client's DB and matches with machine results.
We NEVER write to client's DB — only read.
"""

import sqlite3
import configparser
import os


def get_client_db_connection(config):
    """Connect to client's existing database."""
    db_type = config.get('CLIENT_DB', 'type', fallback='').lower()
    host = config.get('CLIENT_DB', 'host', fallback='localhost')
    port = config.get('CLIENT_DB', 'port', fallback='')
    db_name = config.get('CLIENT_DB', 'name', fallback='')
    user = config.get('CLIENT_DB', 'user', fallback='')
    password = config.get('CLIENT_DB', 'password', fallback='')

    if db_type == 'mysql':
        try:
            import mysql.connector
            return mysql.connector.connect(
                host=host, port=int(port or 3306),
                database=db_name, user=user, password=password,
            )
        except ImportError:
            raise Exception("MySQL connector not installed. Run: pip install mysql-connector-python")

    elif db_type == 'postgresql':
        try:
            import psycopg2
            return psycopg2.connect(
                host=host, port=int(port or 5432),
                dbname=db_name, user=user, password=password,
            )
        except ImportError:
            raise Exception("PostgreSQL connector not installed. Run: pip install psycopg2-binary")

    elif db_type in ('mssql', 'sqlserver', 'sql server'):
        try:
            import pyodbc
            conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={host};DATABASE={db_name};UID={user};PWD={password}"
            return pyodbc.connect(conn_str)
        except ImportError:
            raise Exception("ODBC driver not installed. Run: pip install pyodbc")

    elif db_type == 'sqlite':
        db_path = config.get('CLIENT_DB', 'name', fallback='')
        if not os.path.exists(db_path):
            raise Exception(f"SQLite database not found: {db_path}")
        return sqlite3.connect(db_path)

    elif db_type in ('access', 'mdb', 'accdb'):
        try:
            import pyodbc
            db_path = config.get('CLIENT_DB', 'name', fallback='')
            conn_str = f"DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={db_path}"
            return pyodbc.connect(conn_str)
        except ImportError:
            raise Exception("ODBC driver not installed. Run: pip install pyodbc")

    else:
        raise Exception(f"Unsupported database type: {db_type}")


def sync_patients_from_client_db(config, local_db_path="lab_data.db"):
    """
    Read patients from client's database and sync to our local database.
    Only READS from client DB — never writes.
    Returns count of new patients synced.
    """
    if not config.has_section('CLIENT_DB'):
        return 0, "CLIENT_DB section not in config"

    if config.get('CLIENT_DB', 'enabled', fallback='no').lower() != 'yes':
        return 0, "Client DB sync is disabled"

    query = config.get('CLIENT_DB', 'patient_query', fallback='')
    if not query:
        return 0, "No patient_query defined in config"

    try:
        # Connect to client's DB
        client_conn = get_client_db_connection(config)
        cursor = client_conn.cursor()
        cursor.execute(query)

        # Get column names
        columns = [desc[0].lower() for desc in cursor.description]
        rows = cursor.fetchall()
        client_conn.close()

        # Connect to our local DB
        local_conn = sqlite3.connect(local_db_path)
        local_conn.row_factory = sqlite3.Row

        synced = 0
        skipped = 0

        for row in rows:
            # Map columns to values
            data = dict(zip(columns, row))

            mrn = str(data.get('mrn', data.get('id', data.get('patient_id', '')))).strip()
            name = str(data.get('name', data.get('patient_name', data.get('full_name', '')))).strip()
            gender = str(data.get('gender', data.get('sex', ''))).strip()[:1].upper()
            dob = str(data.get('dob', data.get('date_of_birth', data.get('birth_date', '')))).strip()
            phone = str(data.get('phone', data.get('mobile', data.get('contact', '')))).strip()

            if not mrn or not name:
                skipped += 1
                continue

            # Check if already exists in our DB
            existing = local_conn.execute("SELECT id FROM patients WHERE mrn = ?", (mrn,)).fetchone()
            if existing:
                skipped += 1
                continue

            # Insert into our DB
            local_conn.execute(
                "INSERT INTO patients (mrn, name, gender, dob, phone) VALUES (?, ?, ?, ?, ?)",
                (mrn, name, gender if gender in ('M', 'F') else None, dob if dob and dob != 'None' else None, phone if phone and phone != 'None' else None)
            )
            synced += 1

        local_conn.commit()
        local_conn.close()

        return synced, f"Synced {synced} new patients, {skipped} already existed"

    except Exception as e:
        return 0, f"Error: {str(e)}"


def find_patient_in_client_db(config, mrn_or_id):
    """Search for a specific patient in client's database by MRN or ID."""
    if not config.has_section('CLIENT_DB') or config.get('CLIENT_DB', 'enabled', fallback='no').lower() != 'yes':
        return None

    query = config.get('CLIENT_DB', 'patient_query', fallback='')
    if not query:
        return None

    try:
        client_conn = get_client_db_connection(config)
        cursor = client_conn.cursor()

        # Add WHERE clause to search
        search_query = f"SELECT * FROM ({query}) AS patients WHERE mrn = %s OR name LIKE %s"

        # Adjust for different DB types
        db_type = config.get('CLIENT_DB', 'type', fallback='').lower()
        if db_type == 'sqlite':
            search_query = search_query.replace('%s', '?')
            cursor.execute(search_query, (mrn_or_id, f"%{mrn_or_id}%"))
        else:
            cursor.execute(search_query, (mrn_or_id, f"%{mrn_or_id}%"))

        columns = [desc[0].lower() for desc in cursor.description]
        row = cursor.fetchone()
        client_conn.close()

        if row:
            return dict(zip(columns, row))
        return None

    except Exception:
        return None


def test_connection(config):
    """Test if we can connect to client's database."""
    try:
        conn = get_client_db_connection(config)
        cursor = conn.cursor()

        query = config.get('CLIENT_DB', 'patient_query', fallback='SELECT 1')
        cursor.execute(query)
        count = len(cursor.fetchall())
        conn.close()

        return True, f"Connected! Found {count} patients."

    except Exception as e:
        return False, f"Connection failed: {str(e)}"
