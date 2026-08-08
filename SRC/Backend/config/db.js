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

function validateRequiredFields(userData) {
  const requiredFields = ["firstName", "lastName", "email", "username", "password", "company"];
  const missingField = requiredFields.find((field) => !String(userData[field] || "").trim());

  if (missingField) {
    throw new Error("Todos los campos obligatorios deben estar completos.");
  }
}

async function createUser(userData) {
  validateRequiredFields(userData);

  const username = normalizeLoginValue(userData.username);
  const email = normalizeLoginValue(userData.email);

  // Verificar si ya existe usuario o correo
  const [existingUsers] = await pool.query(
    "SELECT id FROM users WHERE username = ? OR email = ?",
    [username, email]
  );

  if (existingUsers.length > 0) {
    throw new Error("Ya existe una cuenta registrada con ese usuario o correo.");
  }

  // Insertar nuevo usuario
  const [result] = await pool.query(
    `INSERT INTO users (first_name, last_name, second_last_name, email, username, password, company, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Administrador')`,
    [
      userData.firstName.trim(),
      userData.lastName.trim(),
      String(userData.secondLastName || "").trim(),
      email,
      username,
      userData.password,
      userData.company,
    ]
  );

  const [newUser] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
  return publicUser(newUser[0]);
}

async function loginUser(username, password) {
  const login = normalizeLoginValue(username);

  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, second_last_name, email, username, company, role, created_at
     FROM users
     WHERE username = ? AND password = ?`,
    [login, password]
  );

  return rows.length > 0 ? publicUser(rows[0]) : null;
}

async function getUsers() {
  const [rows] = await pool.query("SELECT * FROM users");
  return rows.map(publicUser);
}

module.exports = {
  createUser,
  getUsers,
  loginUser,
};