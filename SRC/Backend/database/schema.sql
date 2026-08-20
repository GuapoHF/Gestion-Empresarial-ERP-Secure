-- Esquema PostgreSQL para Supabase. Ejecuta el archivo completo en SQL Editor.
-- La API usa una conexion PostgreSQL de servidor; nunca expongas SUPABASE_DB_URL en el frontend.

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL UNIQUE,
  legal_name VARCHAR(200) NOT NULL,
  rtn VARCHAR(40) NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'HN',
  country_name VARCHAR(80) NOT NULL DEFAULT 'Honduras',
  locale VARCHAR(12) NOT NULL DEFAULT 'es-HN',
  currency_code CHAR(3) NOT NULL DEFAULT 'HNL',
  currency_symbol VARCHAR(8) NOT NULL DEFAULT 'L',
  tax_id_label VARCHAR(20) NOT NULL DEFAULT 'RTN',
  tax_id VARCHAR(40) NOT NULL DEFAULT '',
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 15,
  city VARCHAR(120) NOT NULL DEFAULT 'Tegucigalpa',
  active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  second_last_name VARCHAR(120),
  email VARCHAR(180) NOT NULL UNIQUE,
  username VARCHAR(80) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL DEFAULT '',
  password_hash VARCHAR(255),
  company VARCHAR(160),
  company_id INT,
  role VARCHAR(40) NOT NULL DEFAULT 'Empleado',
  is_global_admin SMALLINT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Activo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registration_requests (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  second_last_name VARCHAR(120),
  email VARCHAR(180) NOT NULL,
  username VARCHAR(80) NOT NULL,
  password VARCHAR(255) NOT NULL DEFAULT '',
  password_hash VARCHAR(255),
  company VARCHAR(160),
  company_id INT NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'Empleado',
  status VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
  decided_by INT,
  decided_at TIMESTAMP,
  rejection_reason VARCHAR(300),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_recovery_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(120) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_datasets (
  id BIGSERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  module_key VARCHAR(40) NOT NULL,
  view_key VARCHAR(40) NOT NULL,
  rows_json TEXT NOT NULL,
  updated_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_business_dataset UNIQUE (company_id, module_key, view_key)
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  seed_key VARCHAR(80),
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  second_last_name VARCHAR(120),
  email VARCHAR(180) NOT NULL,
  birth_date DATE,
  birth_place VARCHAR(120),
  gender VARCHAR(30) NOT NULL DEFAULT 'No especificado',
  identity_number VARCHAR(40),
  tax_number VARCHAR(40),
  social_security_number VARCHAR(40),
  position VARCHAR(120) NOT NULL,
  branch VARCHAR(120) NOT NULL,
  system_role VARCHAR(40) NOT NULL DEFAULT 'Empleado',
  status VARCHAR(30) NOT NULL DEFAULT 'Activo',
  created_by INT,
  deleted_by INT,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_employee_email_company UNIQUE (company_id, email),
  CONSTRAINT uq_employee_seed_company UNIQUE (company_id, seed_key)
);

CREATE TABLE IF NOT EXISTS accounting_balances (
  id BIGSERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  period CHAR(7) NOT NULL,
  account_code VARCHAR(30) NOT NULL,
  account_name VARCHAR(180) NOT NULL,
  account_type VARCHAR(40) NOT NULL,
  opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  debit DECIMAL(18,2) NOT NULL DEFAULT 0,
  credit DECIMAL(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT uq_accounting_balance UNIQUE (company_id, period, account_code)
);

CREATE TABLE IF NOT EXISTS payroll_concepts (
  id BIGSERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  concept_key VARCHAR(20) NOT NULL,
  description VARCHAR(180) NOT NULL,
  status VARCHAR(30) NOT NULL,
  integrates_salary VARCHAR(10) NOT NULL,
  calculation_scope VARCHAR(30) NOT NULL,
  benefit VARCHAR(10) NOT NULL,
  movement_type VARCHAR(20) NOT NULL,
  accumulated DECIMAL(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT uq_payroll_concept UNIQUE (company_id, concept_key)
);

CREATE TABLE IF NOT EXISTS sales_profit_lines (
  id BIGSERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  period CHAR(7) NOT NULL,
  product_code VARCHAR(40) NOT NULL,
  description VARCHAR(180) NOT NULL,
  quantity DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT uq_sales_profit_line UNIQUE (company_id, period, product_code)
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id BIGSERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  supplier VARCHAR(180) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'Recibida',
  net_weight DECIMAL(18,2) NOT NULL DEFAULT 0,
  gross_weight DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_invoice UNIQUE (company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  work_order VARCHAR(30) NOT NULL,
  style_code VARCHAR(30) NOT NULL,
  description VARCHAR(180) NOT NULL,
  color VARCHAR(80),
  quantity DECIMAL(18,2) NOT NULL DEFAULT 0,
  unit VARCHAR(10) NOT NULL,
  unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
  line_total DECIMAL(18,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_registration_status_company ON registration_requests(status, company_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_employee_company_status ON employees(company_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines ON purchase_invoice_lines(invoice_id);

INSERT INTO companies (code, name, legal_name, rtn, country_code, country_name, locale, currency_code, currency_symbol, tax_id_label, tax_id, tax_rate, city) VALUES
('VICMAR_HN', 'Vicmar', 'Telas Americanas Vicmar, S. de R.L.', '0801-2024-166420', 'HN', 'Honduras', 'es-HN', 'HNL', 'L', 'RTN', '0801-2024-166420', 15, 'Villanueva, Cortes'),
('TELAS_OLIMPICA_MX', 'Telas Olímpica', 'Telas Olímpica, S.A. de C.V.', 'TELAS', 'MX', 'México', 'es-MX', 'MXN', '$', 'RFC', 'TELAS', 16, 'Ciudad de México'),
('GRUPO_CIRSA_HN', 'Grupo Cirsa', 'Grupo Cirsa, S. de R.L.', '0801-2026-104521', 'HN', 'Honduras', 'es-HN', 'HNL', 'L', 'RTN', '0801-2026-104521', 15, 'Tegucigalpa, Francisco Morazan')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, legal_name = EXCLUDED.legal_name, tax_id = EXCLUDED.tax_id;
