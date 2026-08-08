const GESTION_USERS_KEY = "gestionUsers";
const GESTION_SESSION_KEY = "gestionSession";

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

const userSql = {
  createTable: `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    second_last_name TEXT,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    company TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Administrador',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  insertUser: `INSERT INTO users (first_name, last_name, second_last_name, email, username, password, company, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
  findByCredentials: `SELECT id, first_name, last_name, second_last_name, email, username, company, role
    FROM users WHERE username = ? AND password = ?;`,
};

function getStoredUsers() {
  const storedUsers = JSON.parse(localStorage.getItem(GESTION_USERS_KEY) || "[]");
  const mergedUsers = [...defaultUsers];

  storedUsers.forEach((storedUser) => {
    const exists = mergedUsers.some((user) => user.username === storedUser.username || user.email === storedUser.email);

    if (!exists) {
      mergedUsers.push(storedUser);
    }
  });

  localStorage.setItem(GESTION_USERS_KEY, JSON.stringify(mergedUsers));
  return mergedUsers;
}

function saveUsers(users) {
  localStorage.setItem(GESTION_USERS_KEY, JSON.stringify(users));
}

function normalizeLoginValue(value) {
  return value.trim().toLowerCase();
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function createUser(userData) {
  const users = getStoredUsers();
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
    secondLastName: userData.secondLastName.trim(),
    email,
    username,
    password: userData.password,
    company: userData.company,
    role: "Administrador",
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);
  return publicUser(newUser);
}

function loginUser(username, password) {
  const login = normalizeLoginValue(username);
  const user = getStoredUsers().find((storedUser) => storedUser.username === login && storedUser.password === password);

  if (!user) {
    return null;
  }

  const sessionUser = publicUser(user);
  sessionStorage.setItem(GESTION_SESSION_KEY, JSON.stringify(sessionUser));
  sessionStorage.setItem("gestionUser", sessionUser.username);
  return sessionUser;
}

function getCurrentUser() {
  return JSON.parse(sessionStorage.getItem(GESTION_SESSION_KEY) || "null");
}

function logoutUser() {
  sessionStorage.removeItem(GESTION_SESSION_KEY);
  sessionStorage.removeItem("gestionUser");
}

window.gestionUserDb = {
  sql: userSql,
  createUser,
  getCurrentUser,
  getStoredUsers,
  loginUser,
  logoutUser,
};
