CREATE DATABASE IF NOT EXISTS textiles_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE textiles_db;

CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  is_global_admin TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Activo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_company (company_id)
);

CREATE TABLE IF NOT EXISTS registration_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  decided_at DATETIME,
  rejection_reason VARCHAR(300),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_registration_status_company (status, company_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_sessions_user (user_id, expires_at)
);

CREATE TABLE IF NOT EXISTS password_recovery_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(120) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_datasets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  module_key VARCHAR(40) NOT NULL,
  view_key VARCHAR(40) NOT NULL,
  rows_json LONGTEXT NOT NULL,
  updated_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_business_dataset (company_id, module_key, view_key)
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
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
  deleted_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_employee_email_company (company_id, email),
  UNIQUE KEY uq_employee_seed_company (company_id, seed_key),
  INDEX idx_employee_company_status (company_id, status)
);

CREATE TABLE IF NOT EXISTS accounting_balances (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  period CHAR(7) NOT NULL,
  account_code VARCHAR(30) NOT NULL,
  account_name VARCHAR(180) NOT NULL,
  account_type VARCHAR(40) NOT NULL,
  opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  debit DECIMAL(18,2) NOT NULL DEFAULT 0,
  credit DECIMAL(18,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_accounting_balance (company_id, period, account_code)
);

CREATE TABLE IF NOT EXISTS payroll_concepts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  concept_key VARCHAR(20) NOT NULL,
  description VARCHAR(180) NOT NULL,
  status VARCHAR(30) NOT NULL,
  integrates_salary VARCHAR(10) NOT NULL,
  calculation_scope VARCHAR(30) NOT NULL,
  benefit VARCHAR(10) NOT NULL,
  movement_type VARCHAR(20) NOT NULL,
  accumulated DECIMAL(18,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_payroll_concept (company_id, concept_key)
);

CREATE TABLE IF NOT EXISTS sales_profit_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  period CHAR(7) NOT NULL,
  product_code VARCHAR(40) NOT NULL,
  description VARCHAR(180) NOT NULL,
  quantity DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(18,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_sales_profit_line (company_id, period, product_code)
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
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
  UNIQUE KEY uq_purchase_invoice (company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  work_order VARCHAR(30) NOT NULL,
  style_code VARCHAR(30) NOT NULL,
  description VARCHAR(180) NOT NULL,
  color VARCHAR(80),
  quantity DECIMAL(18,2) NOT NULL DEFAULT 0,
  unit VARCHAR(10) NOT NULL,
  unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
  line_total DECIMAL(18,2) NOT NULL DEFAULT 0,
  INDEX idx_purchase_invoice_lines (invoice_id)
);
