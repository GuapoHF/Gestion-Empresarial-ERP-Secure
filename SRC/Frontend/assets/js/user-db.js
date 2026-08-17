const GESTION_SESSION_KEY = "gestionSession";
const GESTION_TOKEN_KEY = "gestionAuthToken";
const API_BASE_URL = `${window.location.origin}/api`;

function normalizeLoginValue(value) {
  return String(value || "").trim().toLowerCase();
}

function getAuthToken() {
  return sessionStorage.getItem(GESTION_TOKEN_KEY) || "";
}

async function requestJson(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getAuthToken();
  if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new Error("No se pudo conectar con el servidor. Verifica que XAMPP y el backend esten activos.");
  }
  const responseType = response.headers.get("content-type") || "";
  const data = responseType.includes("application/json") ? await response.json().catch(() => ({})) : {};
  if (!response.ok) {
    if (response.status === 401) clearSession();
    if (!responseType.includes("application/json")) {
      throw new Error("El backend no respondio correctamente. Abre la aplicacion desde http://localhost:3000 y verifica que npm start este activo.");
    }
    throw new Error(data.message || `No se pudo completar la solicitud (HTTP ${response.status}).`);
  }
  return data;
}

function storeSession(user, token) {
  sessionStorage.setItem(GESTION_SESSION_KEY, JSON.stringify(user));
  sessionStorage.setItem(GESTION_TOKEN_KEY, token);
  sessionStorage.setItem("gestionUser", user.username);
}

function clearSession() {
  sessionStorage.removeItem(GESTION_SESSION_KEY);
  sessionStorage.removeItem(GESTION_TOKEN_KEY);
  sessionStorage.removeItem("gestionUser");
}

async function listCompanies() {
  const data = await requestJson("/companies", { auth: false });
  return data.companies || [];
}

async function createUser(userData) {
  const data = await requestJson("/auth/register", { method: "POST", body: userData, auth: false });
  return data.registration;
}

async function loginUser(username, password) {
  try {
    const data = await requestJson("/auth/login", { method: "POST", body: { username: normalizeLoginValue(username), password }, auth: false });
    storeSession(data.user, data.token);
    return data.user;
  } catch (error) {
    if (/Usuario o contrasena/.test(error.message)) return null;
    throw error;
  }
}

function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem(GESTION_SESSION_KEY) || "null"); }
  catch (error) { return null; }
}

async function validateSession() {
  if (!getAuthToken()) return null;
  try {
    const data = await requestJson("/auth/session");
    sessionStorage.setItem(GESTION_SESSION_KEY, JSON.stringify(data.user));
    return data.user;
  } catch (error) {
    clearSession();
    return null;
  }
}

async function logoutUser() {
  try { if (getAuthToken()) await requestJson("/auth/logout", { method: "POST", body: {} }); }
  catch (error) { /* The local session must still be cleared. */ }
  clearSession();
}

async function recoverPassword(email) {
  return requestJson("/auth/recover", { method: "POST", body: { email: normalizeLoginValue(email) }, auth: false });
}

async function resetPassword(token, password) {
  return requestJson("/auth/reset", { method: "POST", body: { token, password }, auth: false });
}

async function deleteOwnAccount(password, confirmation) {
  const result = await requestJson("/auth/account", { method: "DELETE", body: { password, confirmation } });
  clearSession();
  return result;
}

async function getRegistrations(filters = {}) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.companyId) query.set("companyId", filters.companyId);
  const data = await requestJson(`/admin/registrations?${query}`);
  return data.registrations || [];
}

async function approveRegistration(id) {
  const data = await requestJson("/admin/registrations/approve", { method: "POST", body: { id } });
  return data.user;
}

async function rejectRegistration(id, reason = "") {
  return requestJson("/admin/registrations/reject", { method: "POST", body: { id, reason } });
}

async function listEmployees(filters = {}) {
  const query = new URLSearchParams();
  if (filters.companyId) query.set("companyId", filters.companyId);
  if (filters.status) query.set("status", filters.status);
  const data = await requestJson(`/employees?${query}`);
  return data.employees || [];
}

async function getEmployee(id) {
  const data = await requestJson(`/employees/${encodeURIComponent(id)}`);
  return data.employee;
}

async function createEmployee(employee) {
  const data = await requestJson("/employees", { method: "POST", body: employee });
  return data.employee;
}

async function updateEmployee(id, employee) {
  const data = await requestJson(`/employees/${encodeURIComponent(id)}`, { method: "PUT", body: employee });
  return data.employee;
}

async function deleteEmployee(id, confirmation) {
  return requestJson(`/employees/${encodeURIComponent(id)}`, { method: "DELETE", body: { confirmation } });
}

async function getDataset(moduleKey, viewKey, companyId) {
  const query = new URLSearchParams({ module: moduleKey, view: viewKey });
  if (companyId) query.set("companyId", companyId);
  return requestJson(`/records?${query}`);
}

async function saveDataset(moduleKey, viewKey, rows, companyId) {
  return requestJson("/records", { method: "PUT", body: { moduleKey, viewKey, rows, companyId } });
}

async function getAccountingReport(type, period, companyId) {
  const query = new URLSearchParams({ type, period });
  if (companyId) query.set("companyId", companyId);
  const data = await requestJson(`/accounting/reports?${query}`);
  return data.report;
}

window.gestionUserDb = {
  approveRegistration,
  createEmployee,
  createUser,
  deleteEmployee,
  deleteOwnAccount,
  getAccountingReport,
  getAuthToken,
  getCurrentUser,
  getDataset,
  getEmployee,
  getRegistrations,
  listCompanies,
  listEmployees,
  loginUser,
  logoutUser,
  recoverPassword,
  rejectRegistration,
  resetPassword,
  saveDataset,
  updateEmployee,
  validateSession,
};
