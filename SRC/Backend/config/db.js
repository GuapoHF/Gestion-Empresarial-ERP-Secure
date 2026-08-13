const crypto = require("crypto");
const pool = require("./connection");

function normalizeLoginValue(value = "") {
  return value.trim().toLowerCase();
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
    company: user.company,
    role: user.role,
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
    company: row.company,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}
function validateRequiredFields(userData) {
  const requiredFields = ["firstName", "lastName", "email", "username", "password", "company"];
  const missingField = requiredFields.find((field) => !String(userData[field] || "").trim());
  if (missingField) throw new Error("Todos los campos obligatorios deben estar completos.");
}
async function ensureAuthTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    second_last_name VARCHAR(120),
    email VARCHAR(180) NOT NULL UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    company VARCHAR(160) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'Empleado',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS registration_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    second_last_name VARCHAR(120),
    email VARCHAR(180) NOT NULL UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    company VARCHAR(160) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'Empleado',
    status VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS password_recovery_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(120) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const [admins] = await pool.query("SELECT id FROM users WHERE role = 'Administrador' LIMIT 1");
  if (admins.length === 0) {
    await pool.query(
      `INSERT IGNORE INTO users (first_name, last_name, second_last_name, email, username, password, company, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["Gabriel", "Hernandez", "Flores", "gabriel.hernandez@textilesgh.com", "gabrielh", "12345678", "Textiles GH", "Administrador"]
    );
  }
}
async function assertAdmin(username) {
  const login = normalizeLoginValue(username);
  const [rows] = await pool.query("SELECT id FROM users WHERE username = ? AND role = 'Administrador'", [login]);
  if (rows.length === 0) throw new Error("Solo una cuenta administradora puede autorizar registros.");
}
async function requestRegistration(userData) {
  await ensureAuthTables();
  validateRequiredFields(userData);
  const username = normalizeLoginValue(userData.username);
  const email = normalizeLoginValue(userData.email);
  const [existingUsers] = await pool.query("SELECT id FROM users WHERE username = ? OR email = ?", [username, email]);
  if (existingUsers.length > 0) throw new Error("Ya existe una cuenta registrada con ese usuario o correo.");
  const [existingRequests] = await pool.query("SELECT id FROM registration_requests WHERE username = ? OR email = ?", [username, email]);
  if (existingRequests.length > 0) throw new Error("Ya existe una solicitud pendiente con ese usuario o correo.");
  const role = userData.role === "Administrador" ? "Administrador" : "Empleado";
  const [result] = await pool.query(
    `INSERT INTO registration_requests (first_name, last_name, second_last_name, email, username, password, company, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userData.firstName.trim(), userData.lastName.trim(), String(userData.secondLastName || "").trim(), email, username, userData.password, userData.company, role]
  );
  const [rows] = await pool.query("SELECT * FROM registration_requests WHERE id = ?", [result.insertId]);
  return publicRegistration(rows[0]);
}
async function getPendingRegistrations() {
  await ensureAuthTables();
  const [rows] = await pool.query("SELECT * FROM registration_requests WHERE status = 'Pendiente' ORDER BY created_at ASC");
  return rows.map(publicRegistration);
}
async function approveRegistration(id, adminUsername) {
  await ensureAuthTables();
  await assertAdmin(adminUsername);
  const [rows] = await pool.query("SELECT * FROM registration_requests WHERE id = ? AND status = 'Pendiente'", [id]);
  if (rows.length === 0) throw new Error("La solicitud no existe o ya fue procesada.");
  const request = rows[0];
  const [result] = await pool.query(
    `INSERT INTO users (first_name, last_name, second_last_name, email, username, password, company, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [request.first_name, request.last_name, request.second_last_name, request.email, request.username, request.password, request.company, request.role]
  );
  await pool.query("UPDATE registration_requests SET status = 'Aprobada' WHERE id = ?", [id]);
  const [user] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
  return publicUser(user[0]);
}
async function rejectRegistration(id, adminUsername) {
  await ensureAuthTables();
  await assertAdmin(adminUsername);
  const [result] = await pool.query("UPDATE registration_requests SET status = 'Rechazada' WHERE id = ? AND status = 'Pendiente'", [id]);
  if (result.affectedRows === 0) throw new Error("La solicitud no existe o ya fue procesada.");
}
async function loginUser(username, password) {
  await ensureAuthTables();
  const login = normalizeLoginValue(username);
  const [rows] = await pool.query(`SELECT id, first_name, last_name, second_last_name, email, username, company, role, created_at FROM users WHERE username = ? AND password = ?`, [login, password]);
  return rows.length > 0 ? publicUser(rows[0]) : null;
}
async function sendPasswordRecovery(email, origin = "http://localhost:3000") {
  await ensureAuthTables();
  const normalizedEmail = normalizeLoginValue(email);
  const [rows] = await pool.query("SELECT id, email, username FROM users WHERE email = ?", [normalizedEmail]);
  if (rows.length === 0) return { sent: true };
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query("INSERT INTO password_recovery_tokens (user_id, token, expires_at) VALUES (?, ?, ?)", [rows[0].id, token, expiresAt]);
  const recoveryUrl = `${origin}/login.html?recoveryToken=${token}`;
  console.log(`Enlace de recuperacion para ${rows[0].email}: ${recoveryUrl}`);
  return { sent: true, recoveryUrl: process.env.NODE_ENV === "production" ? undefined : recoveryUrl };
}
module.exports = { approveRegistration, getPendingRegistrations, loginUser, rejectRegistration, requestRegistration, sendPasswordRecovery };
