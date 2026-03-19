-- Laboratory Information System - Database Schema
-- PostgreSQL

-- Drop tables if exist (for fresh setup)
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS samples CASCADE;
DROP TABLE IF EXISTS reference_ranges CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =============================================
-- PATIENTS TABLE
-- =============================================
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    mrn VARCHAR(50) UNIQUE NOT NULL,           -- Medical Record Number
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    dob DATE,
    gender VARCHAR(1) CHECK (gender IN ('M', 'F', 'O')),
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_patients_phone ON patients(phone);

-- =============================================
-- DOCTORS TABLE
-- =============================================
CREATE TABLE doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    specialization VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doctors_name ON doctors(name);

-- =============================================
-- SAMPLES TABLE
-- =============================================
CREATE TABLE samples (
    id SERIAL PRIMARY KEY,
    sample_id VARCHAR(50) UNIQUE NOT NULL,      -- Barcode / Machine Sample ID
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    doctor_id INTEGER REFERENCES doctors(id),
    test_panel VARCHAR(100),                     -- e.g., CBC, LFT, RFT
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    received_at TIMESTAMP,
    reported_at TIMESTAMP,
    machine_id VARCHAR(50),                      -- Which analyzer processed it
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'verified', 'printed')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_samples_sample_id ON samples(sample_id);
CREATE INDEX idx_samples_patient_id ON samples(patient_id);
CREATE INDEX idx_samples_status ON samples(status);
CREATE INDEX idx_samples_collected_at ON samples(collected_at);
CREATE INDEX idx_samples_created_at ON samples(created_at);

-- =============================================
-- RESULTS TABLE
-- =============================================
CREATE TABLE results (
    id SERIAL PRIMARY KEY,
    sample_id INTEGER NOT NULL REFERENCES samples(id),
    test_code VARCHAR(20) NOT NULL,
    test_name VARCHAR(100) NOT NULL,
    value VARCHAR(50),
    unit VARCHAR(30),
    ref_low DECIMAL(10,3),
    ref_high DECIMAL(10,3),
    flag VARCHAR(5) DEFAULT 'N'
        CHECK (flag IN ('N', 'H', 'L', 'A', 'HH', 'LL')),
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'preliminary', 'final', 'corrected')),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMP
);

CREATE INDEX idx_results_sample_id ON results(sample_id);
CREATE INDEX idx_results_test_code ON results(test_code);
CREATE INDEX idx_results_flag ON results(flag);

-- =============================================
-- REFERENCE RANGES TABLE
-- =============================================
CREATE TABLE reference_ranges (
    id SERIAL PRIMARY KEY,
    test_code VARCHAR(20) NOT NULL,
    test_name VARCHAR(100) NOT NULL,
    gender VARCHAR(1) CHECK (gender IN ('M', 'F', 'A')),  -- A = All
    age_min INTEGER DEFAULT 0,
    age_max INTEGER DEFAULT 150,
    ref_low DECIMAL(10,3),
    ref_high DECIMAL(10,3),
    unit VARCHAR(30),
    critical_low DECIMAL(10,3),
    critical_high DECIMAL(10,3),
    UNIQUE(test_code, gender, age_min, age_max)
);

CREATE INDEX idx_ref_ranges_test_code ON reference_ranges(test_code);

-- =============================================
-- USERS TABLE (Lab Staff)
-- =============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('admin', 'technician', 'doctor', 'receptionist')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- =============================================
-- SEED DATA: Common Reference Ranges (Pakistan labs)
-- =============================================
INSERT INTO reference_ranges (test_code, test_name, gender, age_min, age_max, ref_low, ref_high, unit) VALUES
-- CBC
('WBC', 'White Blood Cells', 'A', 0, 150, 4.0, 10.0, '10*3/uL'),
('RBC', 'Red Blood Cells', 'M', 0, 150, 4.5, 5.5, '10*6/uL'),
('RBC', 'Red Blood Cells', 'F', 0, 150, 4.0, 5.0, '10*6/uL'),
('HGB', 'Hemoglobin', 'M', 0, 150, 13.0, 17.0, 'g/dL'),
('HGB', 'Hemoglobin', 'F', 0, 150, 12.0, 16.0, 'g/dL'),
('HCT', 'Hematocrit', 'M', 0, 150, 38.0, 50.0, '%'),
('HCT', 'Hematocrit', 'F', 0, 150, 36.0, 44.0, '%'),
('PLT', 'Platelets', 'A', 0, 150, 150.0, 400.0, '10*3/uL'),
('MCV', 'Mean Corpuscular Volume', 'A', 0, 150, 80.0, 100.0, 'fL'),
('MCH', 'Mean Corpuscular Hemoglobin', 'A', 0, 150, 27.0, 33.0, 'pg'),
('MCHC', 'Mean Corpuscular Hb Conc', 'A', 0, 150, 32.0, 36.0, 'g/dL'),
-- Liver Function
('ALT', 'Alanine Aminotransferase', 'A', 0, 150, 7.0, 56.0, 'U/L'),
('AST', 'Aspartate Aminotransferase', 'A', 0, 150, 10.0, 40.0, 'U/L'),
('ALP', 'Alkaline Phosphatase', 'A', 0, 150, 44.0, 147.0, 'U/L'),
('TBIL', 'Total Bilirubin', 'A', 0, 150, 0.1, 1.2, 'mg/dL'),
('DBIL', 'Direct Bilirubin', 'A', 0, 150, 0.0, 0.3, 'mg/dL'),
('ALB', 'Albumin', 'A', 0, 150, 3.5, 5.5, 'g/dL'),
('TP', 'Total Protein', 'A', 0, 150, 6.0, 8.3, 'g/dL'),
-- Renal Function
('BUN', 'Blood Urea Nitrogen', 'A', 0, 150, 7.0, 20.0, 'mg/dL'),
('CREAT', 'Creatinine', 'M', 0, 150, 0.7, 1.3, 'mg/dL'),
('CREAT', 'Creatinine', 'F', 0, 150, 0.6, 1.1, 'mg/dL'),
('UA', 'Uric Acid', 'M', 0, 150, 3.4, 7.0, 'mg/dL'),
('UA', 'Uric Acid', 'F', 0, 150, 2.4, 6.0, 'mg/dL'),
-- Blood Sugar
('GLU', 'Glucose (Fasting)', 'A', 0, 150, 70.0, 100.0, 'mg/dL'),
('HBA1C', 'HbA1c', 'A', 0, 150, 4.0, 5.6, '%'),
-- Lipid Profile
('CHOL', 'Total Cholesterol', 'A', 0, 150, 0.0, 200.0, 'mg/dL'),
('TG', 'Triglycerides', 'A', 0, 150, 0.0, 150.0, 'mg/dL'),
('HDL', 'HDL Cholesterol', 'A', 0, 150, 40.0, 60.0, 'mg/dL'),
('LDL', 'LDL Cholesterol', 'A', 0, 150, 0.0, 100.0, 'mg/dL'),
-- Thyroid
('TSH', 'Thyroid Stimulating Hormone', 'A', 0, 150, 0.4, 4.0, 'mIU/L'),
('T3', 'Triiodothyronine', 'A', 0, 150, 0.8, 2.0, 'ng/mL'),
('T4', 'Thyroxine', 'A', 0, 150, 5.1, 14.1, 'ug/dL'),
('FT4', 'Free T4', 'A', 0, 150, 0.9, 1.7, 'ng/dL');
