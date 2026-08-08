const fs = require("fs");
const path = require("path");

const databasePath = path.join(__dirname, "..", "database", "users.json");

const defaultUsers = [
  {
    id: 1,
    firstName: "Gabriel",
    lastName: "Hernandez",
    secondLastName: "Morales",
    email: "gabriel.hernandez@textilesgh.com",
    username: "gabrielh",
    password: "12345678",
    company: "Textiles GH",
    role: "Administrador",
    createdAt: "2026-08-03T00:00:00.000Z",
  },
];

function ensureDatabase() {
  const databaseDirectory = path.dirname(databasePath);

  if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory, { recursive: true });
  }

  if (!fs.existsSync(databasePath)) {
    fs.writeFileSync(databasePath, JSON.stringify(defaultUsers, null, 2));
  }
}

function normalizeLoginValue(value = "") {
  return value.trim().toLowerCase();
}

function readUsers() {
  ensureDatabase();
  const content = fs.readFileSync(databasePath, "utf8");
  return JSON.parse(content || "[]");
}

function writeUsers(users) {
  ensureDatabase();
  fs.writeFileSync(databasePath, JSON.stringify(users, null, 2));
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function validateRequiredFields(userData) {
  const requiredFields = ["firstName", "lastName", "email", "username", "password", "company"];
  const missingField = requiredFields.find((field) => !String(userData[field] || "").trim());

  if (missingField) {
    throw new Error("Todos los campos obligatorios deben estar completos.");
  }
}

function createUser(userData) {
  validateRequiredFields(userData);

  const users = readUsers();
  const username = normalizeLoginValue(userData.username);
  const email = normalizeLoginValue(userData.email);
  const duplicateUser = users.find((user) => user.username === username || user.email === email);

  if (duplicateUser) {
    throw new Error("Ya existe una cuenta registrada con ese usuario o correo.");
  }

  const newUser = {
    id: Date.now(),
    firstName: userData.firstName.trim(),
    lastName: userData.lastName.trim(),
    secondLastName: String(userData.secondLastName || "").trim(),
    email,
    username,
    password: userData.password,
    company: userData.company,
    role: "Administrador",
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);
  return publicUser(newUser);
}

function loginUser(username, password) {
  const login = normalizeLoginValue(username);
  const user = readUsers().find((storedUser) => storedUser.username === login && storedUser.password === password);

  return user ? publicUser(user) : null;
}

function getUsers() {
  return readUsers().map(publicUser);
}

module.exports = {
  createUser,
  getUsers,
  loginUser,
  readUsers,
};
