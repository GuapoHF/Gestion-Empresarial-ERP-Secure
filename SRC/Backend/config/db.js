const crypto = require("crypto");
const pool = require("./connection");
const { sendRecoveryEmail } = require("./mailer");

const COMPANIES = [
  { legacyCode: "TEXTILES_GH", code: "VICMAR_HN", name: "Vicmar", legalName: "Telas Americanas Vicmar, S. de R.L.", countryCode: "HN", countryName: "Honduras", locale: "es-HN", currencyCode: "HNL", currencySymbol: "L", taxIdLabel: "RTN", taxId: "0801-2024-166420", taxRate: 15, city: "Villanueva, Cortes" },
  { legacyCode: "SALDOS_OLIMPICA_5", code: "TELAS_OLIMPICA_MX", name: "Telas Olímpica", legalName: "Telas Olímpica, S.A. de C.V.", countryCode: "MX", countryName: "México", locale: "es-MX", currencyCode: "MXN", currencySymbol: "$", taxIdLabel: "RFC", taxId: "TELAS", taxRate: 16, city: "Ciudad de México" },
  { legacyCode: "GRUPO_CIRSA", code: "GRUPO_CIRSA_HN", name: "Grupo Cirsa", legalName: "Grupo Cirsa, S. de R.L.", countryCode: "HN", countryName: "Honduras", locale: "es-HN", currencyCode: "HNL", currencySymbol: "L", taxIdLabel: "RTN", taxId: "0801-2026-104521", taxRate: 15, city: "Tegucigalpa, Francisco Morazan" },
];
const ALLOWED_ROLES = ["Empleado", "Ventas", "Compras", "Inventarios", "Contabilidad"];
const SESSION_HOURS = 12;

function normalizeLoginValue(value = "") {
  return String(value).trim().toLowerCase();
}

function cleanText(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash, legacyPassword) {
  if (storedHash?.startsWith("scrypt:")) {
    const [, salt, expected] = storedHash.split(":");
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expectedBuffer = Buffer.from(expected, "hex");
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
  }
  return String(legacyPassword || "") === String(password || "");
}

function publicCompany(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    legalName: row.legal_name,
    rtn: row.tax_id || row.rtn,
    countryCode: row.country_code,
    countryName: row.country_name,
    locale: row.locale,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    taxIdLabel: row.tax_id_label,
    taxId: row.tax_id || row.rtn,
    taxRate: Number(row.tax_rate),
    city: row.city,
    active: Boolean(row.active),
  };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    secondLastName: user.second_last_name || "",
    email: user.email,
    username: user.username,
    companyId: user.company_id,
    companyCode: user.company_code,
    company: user.company_name || user.company,
    countryCode: user.country_code,
    countryName: user.country_name,
    locale: user.locale,
    currencyCode: user.currency_code,
    currencySymbol: user.currency_symbol,
    taxIdLabel: user.tax_id_label,
    taxId: user.tax_id,
    taxRate: Number(user.tax_rate || 0),
    city: user.city,
    role: user.role,
    isGlobalAdmin: Boolean(user.is_global_admin),
    createdAt: user.created_at,
  };
}

function publicRegistration(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    secondLastName: row.second_last_name || "",
    email: row.email,
    username: row.username,
    companyId: row.company_id,
    companyCode: row.company_code,
    company: row.company_name || row.company,
    role: row.role,
    status: row.status,
    rejectionReason: row.rejection_reason || "",
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

function validateRegistration(userData) {
  const firstName = cleanText(userData.firstName);
  const lastName = cleanText(userData.lastName);
  const email = normalizeLoginValue(userData.email);
  const username = normalizeLoginValue(userData.username);
  const password = String(userData.password || "");
  const role = cleanText(userData.role) || "Empleado";

  if (!firstName || !lastName || !email || !username || !password || !userData.companyId) {
    throw new Error("Completa todos los campos obligatorios.");
  }
  if (!/^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(firstName) || !/^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(lastName)) {
    throw new Error("El nombre y los apellidos solo pueden contener letras, espacios, apostrofes o guiones.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) {
    throw new Error("Ingresa un correo electronico valido.");
  }
  if (!/^[a-z0-9._-]{4,40}$/.test(username)) {
    throw new Error("El usuario debe tener entre 4 y 40 caracteres: letras, numeros, punto, guion o guion bajo.");
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("La contrasena debe tener al menos 8 caracteres, una letra y un numero.");
  }
  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error("Selecciona un area de acceso valida.");
  }
  return { firstName, lastName, email, username, password, role };
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function addColumn(tableName, definition) {
  const columnName = definition.trim().split(/\s+/)[0].replace(/`/g, "");
  if (!(await columnExists(tableName, columnName))) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definition}`);
  }
}

async function ensureAuthTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS companies (
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
  )`);
  await addColumn("companies", "country_code CHAR(2) NOT NULL DEFAULT 'HN' AFTER rtn");
  await addColumn("companies", "country_name VARCHAR(80) NOT NULL DEFAULT 'Honduras' AFTER country_code");
  await addColumn("companies", "locale VARCHAR(12) NOT NULL DEFAULT 'es-HN' AFTER country_name");
  await addColumn("companies", "currency_code CHAR(3) NOT NULL DEFAULT 'HNL' AFTER locale");
  await addColumn("companies", "currency_symbol VARCHAR(8) NOT NULL DEFAULT 'L' AFTER currency_code");
  await addColumn("companies", "tax_id_label VARCHAR(20) NOT NULL DEFAULT 'RTN' AFTER currency_symbol");
  await addColumn("companies", "tax_id VARCHAR(40) NOT NULL DEFAULT '' AFTER tax_id_label");
  await addColumn("companies", "tax_rate DECIMAL(5,2) NOT NULL DEFAULT 15 AFTER tax_id");
  await addColumn("companies", "city VARCHAR(120) NOT NULL DEFAULT 'Tegucigalpa' AFTER tax_rate");
  for (const company of COMPANIES) {
    const [existing] = await pool.query("SELECT id FROM companies WHERE code IN (?, ?) ORDER BY code = ? DESC LIMIT 1", [company.code, company.legacyCode, company.code]);
    if (existing.length) {
      await pool.query(
        `UPDATE companies SET code = ?, name = ?, legal_name = ?, rtn = ?, country_code = ?, country_name = ?, locale = ?,
         currency_code = ?, currency_symbol = ?, tax_id_label = ?, tax_id = ?, tax_rate = ?, city = ?, active = 1 WHERE id = ?`,
        [company.code, company.name, company.legalName, company.taxId, company.countryCode, company.countryName, company.locale, company.currencyCode, company.currencySymbol, company.taxIdLabel, company.taxId, company.taxRate, company.city, existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO companies
         (code, name, legal_name, rtn, country_code, country_name, locale, currency_code, currency_symbol, tax_id_label, tax_id, tax_rate, city)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [company.code, company.name, company.legalName, company.taxId, company.countryCode, company.countryName, company.locale, company.currencyCode, company.currencySymbol, company.taxIdLabel, company.taxId, company.taxRate, company.city]
      );
    }
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS users (
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await addColumn("users", "password_hash VARCHAR(255) NULL AFTER password");
  await addColumn("users", "company_id INT NULL AFTER company");
  await addColumn("users", "is_global_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER role");
  await addColumn("users", "status VARCHAR(30) NOT NULL DEFAULT 'Activo' AFTER is_global_admin");

  await pool.query(`CREATE TABLE IF NOT EXISTS registration_requests (
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
    decided_by INT NULL,
    decided_at DATETIME NULL,
    rejection_reason VARCHAR(300) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_registration_status_company (status, company_id)
  )`);
  await addColumn("registration_requests", "password_hash VARCHAR(255) NULL AFTER password");
  await addColumn("registration_requests", "company_id INT NULL AFTER company");
  await addColumn("registration_requests", "decided_by INT NULL AFTER status");
  await addColumn("registration_requests", "decided_at DATETIME NULL AFTER decided_by");
  await addColumn("registration_requests", "rejection_reason VARCHAR(300) NULL AFTER decided_at");

  await pool.query(`CREATE TABLE IF NOT EXISTS auth_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_auth_sessions_user (user_id, expires_at)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS password_recovery_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(120) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const [defaultCompany] = await pool.query("SELECT id, name FROM companies WHERE code = 'VICMAR_HN' LIMIT 1");
  await pool.query(
    `UPDATE users u LEFT JOIN companies c ON c.name = u.company
     SET u.company_id = COALESCE(u.company_id, c.id, ?), u.company = COALESCE(c.name, u.company, ?)
     WHERE u.company_id IS NULL`,
    [defaultCompany[0].id, defaultCompany[0].name]
  );
  await pool.query(
    `UPDATE registration_requests r LEFT JOIN companies c ON c.name = r.company
     SET r.company_id = COALESCE(r.company_id, c.id, ?), r.company = COALESCE(c.name, r.company, ?)
     WHERE r.company_id IS NULL`,
    [defaultCompany[0].id, defaultCompany[0].name]
  );
  await pool.query("UPDATE users u JOIN companies c ON c.id = u.company_id SET u.company = c.name");
  await pool.query("UPDATE registration_requests r JOIN companies c ON c.id = r.company_id SET r.company = c.name");

  const [admins] = await pool.query("SELECT id FROM users WHERE username = 'gabrielh' LIMIT 1");
  if (admins.length === 0) {
    await pool.query(
      `INSERT INTO users (first_name, last_name, second_last_name, email, username, password, password_hash, company, company_id, role, is_global_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      ["Gabriel", "Hernandez", "Flores", "gabriel.hernandez@textilesgh.com", "gabrielh", "__HASHED__", hashPassword("12345678"), defaultCompany[0].name, defaultCompany[0].id, "Administrador"]
    );
  } else {
    await pool.query("UPDATE users SET is_global_admin = 1, role = 'Administrador', status = 'Activo' WHERE username = 'gabrielh'");
  }
}

async function listCompanies() {
  await ensureAuthTables();
  const [rows] = await pool.query("SELECT * FROM companies WHERE active = 1 ORDER BY FIELD(code, 'VICMAR_HN', 'TELAS_OLIMPICA_MX', 'GRUPO_CIRSA_HN')");
  return rows.map(publicCompany);
}

async function requestRegistration(userData) {
  await ensureAuthTables();
  const valid = validateRegistration(userData);
  const [companies] = await pool.query("SELECT * FROM companies WHERE id = ? AND active = 1 LIMIT 1", [Number(userData.companyId)]);
  if (companies.length === 0) throw new Error("La empresa seleccionada no esta disponible.");
  const [existingUsers] = await pool.query("SELECT id FROM users WHERE username = ? OR email = ?", [valid.username, valid.email]);
  if (existingUsers.length > 0) throw new Error("Ya existe una cuenta registrada con ese usuario o correo.");
  const [existingRequests] = await pool.query(
    "SELECT id FROM registration_requests WHERE (username = ? OR email = ?) AND status = 'Pendiente'",
    [valid.username, valid.email]
  );
  if (existingRequests.length > 0) throw new Error("Ya existe una solicitud pendiente con ese usuario o correo.");
  const [result] = await pool.query(
    `INSERT INTO registration_requests
     (first_name, last_name, second_last_name, email, username, password, password_hash, company, company_id, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [valid.firstName, valid.lastName, cleanText(userData.secondLastName), valid.email, valid.username, "__HASHED__", hashPassword(valid.password), companies[0].name, companies[0].id, valid.role]
  );
  const [rows] = await pool.query(
    `SELECT r.*, c.code company_code, c.name company_name FROM registration_requests r
     JOIN companies c ON c.id = r.company_id WHERE r.id = ?`,
    [result.insertId]
  );
  return publicRegistration(rows[0]);
}

async function loginUser(username, password) {
  await ensureAuthTables();
  const login = normalizeLoginValue(username);
  if (!login || !password) return null;
  const [rows] = await pool.query(
    `SELECT u.*, c.code company_code, c.name company_name, c.country_code, c.country_name, c.locale, c.currency_code,
     c.currency_symbol, c.tax_id_label, c.tax_id, c.tax_rate, c.city FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE u.username = ? AND u.status = 'Activo' LIMIT 1`,
    [login]
  );
  if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash, rows[0].password)) return null;
  if (!rows[0].password_hash) {
    await pool.query("UPDATE users SET password_hash = ?, password = '__HASHED__' WHERE id = ?", [hashPassword(password), rows[0].id]);
  }
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW() OR revoked_at IS NOT NULL");
  await pool.query("INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)", [rows[0].id, tokenHash, expiresAt]);
  return { user: publicUser(rows[0]), token, expiresAt };
}

async function getSession(token) {
  await ensureAuthTables();
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const [rows] = await pool.query(
    `SELECT u.*, c.code company_code, c.name company_name, c.country_code, c.country_name, c.locale, c.currency_code,
     c.currency_symbol, c.tax_id_label, c.tax_id, c.tax_rate, c.city, s.expires_at session_expires_at
     FROM auth_sessions s JOIN users u ON u.id = s.user_id JOIN companies c ON c.id = u.company_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > NOW() AND u.status = 'Activo' LIMIT 1`,
    [tokenHash]
  );
  return rows.length ? { ...publicUser(rows[0]), sessionExpiresAt: rows[0].session_expires_at } : null;
}

async function revokeSession(token) {
  if (!token) return;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await pool.query("UPDATE auth_sessions SET revoked_at = NOW() WHERE token_hash = ?", [tokenHash]);
}

function assertGlobalAdmin(user) {
  if (!user?.isGlobalAdmin || user.role !== "Administrador") {
    throw new Error("Solo el administrador global puede autorizar registros.");
  }
}

async function getRegistrations(adminUser, filters = {}) {
  await ensureAuthTables();
  assertGlobalAdmin(adminUser);
  const conditions = [];
  const values = [];
  if (filters.status && filters.status !== "Todos") { conditions.push("r.status = ?"); values.push(filters.status); }
  if (filters.companyId) { conditions.push("r.company_id = ?"); values.push(Number(filters.companyId)); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT r.*, c.code company_code, c.name company_name FROM registration_requests r
     JOIN companies c ON c.id = r.company_id ${where} ORDER BY c.name, r.created_at DESC`,
    values
  );
  return rows.map(publicRegistration);
}

async function approveRegistration(id, adminUser) {
  await ensureAuthTables();
  assertGlobalAdmin(adminUser);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT * FROM registration_requests WHERE id = ? AND status = 'Pendiente' FOR UPDATE", [Number(id)]);
    if (!rows.length) throw new Error("La solicitud no existe o ya fue procesada.");
    const request = rows[0];
    const [duplicates] = await connection.query("SELECT id FROM users WHERE username = ? OR email = ?", [request.username, request.email]);
    if (duplicates.length) throw new Error("Ya existe una cuenta con ese usuario o correo.");
    const [result] = await connection.query(
      `INSERT INTO users (first_name, last_name, second_last_name, email, username, password, password_hash, company, company_id, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [request.first_name, request.last_name, request.second_last_name, request.email, request.username, "__HASHED__", request.password_hash || hashPassword(request.password), request.company, request.company_id, request.role]
    );
    await connection.query("UPDATE registration_requests SET status = 'Aprobada', decided_by = ?, decided_at = NOW() WHERE id = ?", [adminUser.id, request.id]);
    await connection.commit();
    const [users] = await pool.query(
      `SELECT u.*, c.code company_code, c.name company_name, c.country_code, c.country_name, c.locale, c.currency_code,
       c.currency_symbol, c.tax_id_label, c.tax_id, c.tax_rate, c.city FROM users u JOIN companies c ON c.id = u.company_id WHERE u.id = ?`,
      [result.insertId]
    );
    return publicUser(users[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function rejectRegistration(id, adminUser, reason = "") {
  await ensureAuthTables();
  assertGlobalAdmin(adminUser);
  const cleanReason = cleanText(reason).slice(0, 300);
  const [result] = await pool.query(
    `UPDATE registration_requests SET status = 'Rechazada', decided_by = ?, decided_at = NOW(), rejection_reason = ?
     WHERE id = ? AND status = 'Pendiente'`,
    [adminUser.id, cleanReason, Number(id)]
  );
  if (!result.affectedRows) throw new Error("La solicitud no existe o ya fue procesada.");
}

async function sendPasswordRecovery(email, origin = "http://localhost:3000") {
  await ensureAuthTables();
  const normalizedEmail = normalizeLoginValue(email);
  if (!normalizedEmail) throw new Error("Ingresa el correo con el que registraste tu cuenta.");
  const [rows] = await pool.query("SELECT id, email, username FROM users WHERE email = ? AND status = 'Activo' LIMIT 1", [normalizedEmail]);
  if (!rows.length) throw new Error("No existe una cuenta activa con ese correo.");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query("UPDATE password_recovery_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [rows[0].id]);
  await pool.query("INSERT INTO password_recovery_tokens (user_id, token, expires_at) VALUES (?, ?, ?)", [rows[0].id, token, expiresAt]);
  const recoveryUrl = `${origin}/restablecer.html?token=${token}`;
  const delivery = await sendRecoveryEmail({ to: rows[0].email, username: rows[0].username, recoveryUrl });
  return { sent: true, emailRegistered: true, delivered: delivery.delivered, recoveryUrl: process.env.NODE_ENV === "production" ? undefined : recoveryUrl };
}

async function resetPassword(token, password) {
  await ensureAuthTables();
  if (!String(token || "").trim()) throw new Error("El enlace de recuperacion no es valido.");
  if (String(password || "").length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("La nueva contrasena debe tener al menos 8 caracteres, una letra y un numero.");
  }
  const [rows] = await pool.query(
    "SELECT id, user_id FROM password_recovery_tokens WHERE token = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
    [token]
  );
  if (!rows.length) throw new Error("El enlace de recuperacion expiro o ya fue usado.");
  await pool.query("UPDATE users SET password_hash = ?, password = '__HASHED__' WHERE id = ?", [hashPassword(password), rows[0].user_id]);
  await pool.query("UPDATE password_recovery_tokens SET used_at = NOW() WHERE id = ?", [rows[0].id]);
  await pool.query("UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [rows[0].user_id]);
  return { reset: true };
}

module.exports = {
  ALLOWED_ROLES,
  approveRegistration,
  ensureAuthTables,
  getRegistrations,
  getSession,
  listCompanies,
  loginUser,
  rejectRegistration,
  requestRegistration,
  resetPassword,
  revokeSession,
  sendPasswordRecovery,
};
