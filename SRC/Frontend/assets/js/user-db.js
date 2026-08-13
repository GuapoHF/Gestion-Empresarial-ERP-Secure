const GESTION_USERS_KEY = "gestionUsers";
const GESTION_SESSION_KEY = "gestionSession";
const GESTION_REGISTRATION_REQUESTS_KEY = "gestionRegistrationRequests";
const API_BASE_URL = "http://localhost:3000/api/auth";

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
  {
    id: 2,
    firstName: "Mariana",
    lastName: "Lopez",
    secondLastName: "Santos",
    email: "mariana.lopez@textilesgh.com",
    username: "marianal",
    password: "12345678",
    company: "Textiles GH",
    role: "Empleado",
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

async function requestJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "No se pudo completar la solicitud.");
  }

  return data.user || data.registration || data.registrations || data;
}

async function requestAuth(endpoint, payload) {
  return requestJson(`${API_BASE_URL}${endpoint}`, payload);
}

function getPendingRegistrationsLocal() {
  return JSON.parse(localStorage.getItem(GESTION_REGISTRATION_REQUESTS_KEY) || "[]");
}

function savePendingRegistrations(registrations) {
  localStorage.setItem(GESTION_REGISTRATION_REQUESTS_KEY, JSON.stringify(registrations));
}

function createLocalUser(userData) {
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
    role: userData.role === "Administrador" ? "Administrador" : "Empleado",
    createdAt: new Date().toISOString(),
  };

  return newUser;
}

async function createUser(userData) {
  try {
    return await requestAuth("/register", userData);
  } catch (error) {
    if (error instanceof TypeError) {
      const registration = createLocalUser(userData);
      const pendingRegistrations = getPendingRegistrationsLocal();
      const duplicateRequest = pendingRegistrations.find((request) => request.username === registration.username || request.email === registration.email);

      if (duplicateRequest) {
        throw new Error("Ya existe una solicitud pendiente con ese usuario o correo.");
      }

      pendingRegistrations.push({ ...publicUser(registration), id: Date.now(), password: registration.password, status: "Pendiente" });
      savePendingRegistrations(pendingRegistrations);
      return publicUser(registration);
    }

    throw error;
  }
}

function loginLocalUser(username, password) {
  const login = normalizeLoginValue(username);
  const user = getStoredUsers().find((storedUser) => storedUser.username === login && storedUser.password === password);

  return user ? publicUser(user) : null;
}

async function loginUser(username, password) {
  let sessionUser = null;

  try {
    sessionUser = await requestAuth("/login", { username, password });
  } catch (error) {
    if (!(error instanceof TypeError)) {
      return null;
    }

    sessionUser = loginLocalUser(username, password);
  }

  if (!sessionUser) {
    return null;
  }

  sessionStorage.setItem(GESTION_SESSION_KEY, JSON.stringify(sessionUser));
  sessionStorage.setItem("gestionUser", sessionUser.username);
  return sessionUser;
}

function getCurrentUser() {
  return JSON.parse(sessionStorage.getItem(GESTION_SESSION_KEY) || "null");
}

async function recoverPassword(email) {
  try {
    return await requestAuth("/recover", { email });
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }

    const normalizedEmail = normalizeLoginValue(email);
    const user = getStoredUsers().find((storedUser) => storedUser.email === normalizedEmail);

    if (user) {
      console.info(`Enlace de recuperacion enviado a ${user.email}`);
    }

    return { message: "Si el correo existe, se enviaron las instrucciones de recuperacion." };
  }
}

async function getPendingRegistrations() {
  try {
    const response = await fetch("http://localhost:3000/api/admin/registrations");
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudieron cargar las solicitudes.");
    return data.registrations;
  } catch (error) {
    if (error instanceof TypeError) return getPendingRegistrationsLocal();
    throw error;
  }
}

async function approveRegistration(id, adminUsername) {
  try {
    return await requestJson("http://localhost:3000/api/admin/registrations/approve", { id, adminUsername });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== "Administrador") throw new Error("Solo una cuenta administradora puede autorizar registros.");
    const pendingRegistrations = getPendingRegistrationsLocal();
    const registration = pendingRegistrations.find((request) => Number(request.id) === Number(id));
    if (!registration) throw new Error("La solicitud no existe o ya fue procesada.");
    const users = getStoredUsers();
    users.push({ ...registration, status: undefined });
    saveUsers(users);
    savePendingRegistrations(pendingRegistrations.filter((request) => Number(request.id) !== Number(id)));
    return publicUser(registration);
  }
}

async function rejectRegistration(id, adminUsername) {
  try {
    return await requestJson("http://localhost:3000/api/admin/registrations/reject", { id, adminUsername });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== "Administrador") throw new Error("Solo una cuenta administradora puede rechazar registros.");
    savePendingRegistrations(getPendingRegistrationsLocal().filter((request) => Number(request.id) !== Number(id)));
    return { message: "Solicitud rechazada." };
  }
}

function logoutUser() {
  sessionStorage.removeItem(GESTION_SESSION_KEY);
  sessionStorage.removeItem("gestionUser");
}

window.gestionUserDb = {
  sql: userSql,
  approveRegistration,
  createUser,
  getCurrentUser,
  getPendingRegistrations,
  getStoredUsers,
  loginUser,
  logoutUser,
  recoverPassword,
  rejectRegistration,
};
