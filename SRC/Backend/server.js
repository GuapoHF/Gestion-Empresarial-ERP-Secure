const http = require("http");
const path = require("path");
const fs = require("fs");
const {
  approveRegistration,
  deleteOwnAccount,
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
} = require("./config/db");
const { ensureRecordsTable, getDataset, saveDataset } = require("./modules/records");
const { ensureAccountingTables, getAccountingReport } = require("./modules/accounting");
const { createEmployee, deleteEmployee, ensureEmployeesTable, getEmployee, listEmployees, updateEmployee } = require("./modules/employees");

const PORT = Number(process.env.PORT || 3000);
const frontendPath = path.resolve(__dirname, "..", "Frontend");
const rateLimits = new Map();
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".csv": "text/csv; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

function enforceRateLimit(request, scope, maximum, windowMs) {
  const address = request.socket.remoteAddress || "local";
  const key = `${scope}:${address}`;
  const now = Date.now();
  const recent = (rateLimits.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= maximum) {
    const error = new Error("Demasiados intentos. Espera unos minutos antes de volver a intentar.");
    error.statusCode = 429;
    throw error;
  }
  recent.push(now);
  rateLimits.set(key, recent);
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) request.destroy(new Error("La solicitud excede el limite permitido."));
    });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(new Error("El cuerpo de la solicitud no contiene JSON valido.")); }
    });
    request.on("error", reject);
  });
}

function bearerToken(request) {
  const authorization = String(request.headers.authorization || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

async function requireSession(request) {
  const user = await getSession(bearerToken(request));
  if (!user) {
    const error = new Error("Tu sesion expiro. Inicia sesion nuevamente.");
    error.statusCode = 401;
    throw error;
  }
  return user;
}

function serveStaticFile(requestUrl, response) {
  const requestPath = requestUrl.pathname === "/" ? "/login.html" : decodeURIComponent(requestUrl.pathname);
  const filePath = path.resolve(frontendPath, `.${requestPath}`);
  if (filePath !== frontendPath && !filePath.startsWith(`${frontendPath}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    response.end(content);
  });
}

async function handleApi(request, response, requestUrl) {
  const route = requestUrl.pathname;
  if (route === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true, service: "Gestion Empresarial", date: new Date().toISOString() });
    return true;
  }
  if (route === "/api/companies" && request.method === "GET") {
    sendJson(response, 200, { companies: await listCompanies() });
    return true;
  }
  if (route === "/api/auth/register" && request.method === "POST") {
    enforceRateLimit(request, "register", 10, 60 * 60 * 1000);
    const registration = await requestRegistration(await parseJsonBody(request));
    sendJson(response, 201, { registration, message: "Solicitud enviada. El administrador revisara tu acceso para la empresa seleccionada." });
    return true;
  }
  if (route === "/api/auth/login" && request.method === "POST") {
    enforceRateLimit(request, "login", 12, 10 * 60 * 1000);
    const { username, password } = await parseJsonBody(request);
    const result = await loginUser(username, password);
    if (!result) {
      sendJson(response, 401, { message: "Usuario o contrasena incorrectos, o la cuenta aun no ha sido aprobada." });
      return true;
    }
    sendJson(response, 200, { ...result, message: "Sesion iniciada correctamente." });
    return true;
  }
  if (route === "/api/auth/session" && request.method === "GET") {
    sendJson(response, 200, { user: await requireSession(request) });
    return true;
  }
  if (route === "/api/auth/logout" && request.method === "POST") {
    await revokeSession(bearerToken(request));
    sendJson(response, 200, { message: "Sesion cerrada." });
    return true;
  }
  if (route === "/api/auth/recover" && request.method === "POST") {
    enforceRateLimit(request, "recover", 6, 15 * 60 * 1000);
    const { email } = await parseJsonBody(request);
    const origin = process.env.APP_ORIGIN || `http://localhost:${PORT}`;
    await sendPasswordRecovery(email, origin);
    sendJson(response, 200, { sent: true, message: "Si existe una cuenta activa con ese correo, enviaremos las instrucciones de recuperacion." });
    return true;
  }
  if (route === "/api/auth/reset" && request.method === "POST") {
    const { token, password } = await parseJsonBody(request);
    sendJson(response, 200, { message: "Contrasena actualizada. Ya puedes iniciar sesion.", ...(await resetPassword(token, password)) });
    return true;
  }
  if (route === "/api/auth/account" && request.method === "DELETE") {
    enforceRateLimit(request, "delete-account", 5, 15 * 60 * 1000);
    const user = await requireSession(request);
    const { password, confirmation } = await parseJsonBody(request);
    sendJson(response, 200, { ...(await deleteOwnAccount(user, password, confirmation)), message: "Tu cuenta fue eliminada correctamente." });
    return true;
  }

  if (route === "/api/admin/registrations" && request.method === "GET") {
    const user = await requireSession(request);
    const registrations = await getRegistrations(user, {
      status: requestUrl.searchParams.get("status") || "Pendiente",
      companyId: requestUrl.searchParams.get("companyId"),
    });
    sendJson(response, 200, { registrations });
    return true;
  }
  if (route === "/api/admin/registrations/approve" && request.method === "POST") {
    const user = await requireSession(request);
    const { id } = await parseJsonBody(request);
    sendJson(response, 200, { user: await approveRegistration(id, user), message: "Cuenta aprobada correctamente." });
    return true;
  }
  if (route === "/api/admin/registrations/reject" && request.method === "POST") {
    const user = await requireSession(request);
    const { id, reason } = await parseJsonBody(request);
    await rejectRegistration(id, user, reason);
    sendJson(response, 200, { message: "Solicitud rechazada correctamente." });
    return true;
  }

  if (route === "/api/employees" && request.method === "GET") {
    const user = await requireSession(request);
    sendJson(response, 200, { employees: await listEmployees(user, Object.fromEntries(requestUrl.searchParams)) });
    return true;
  }
  if (route === "/api/employees" && request.method === "POST") {
    const user = await requireSession(request);
    sendJson(response, 201, { employee: await createEmployee(user, await parseJsonBody(request)), message: "Empleado registrado correctamente." });
    return true;
  }
  const employeeMatch = route.match(/^\/api\/employees\/(\d+)$/);
  if (employeeMatch && request.method === "GET") {
    const user = await requireSession(request);
    sendJson(response, 200, { employee: await getEmployee(user, employeeMatch[1]) });
    return true;
  }
  if (employeeMatch && request.method === "PUT") {
    const user = await requireSession(request);
    sendJson(response, 200, { employee: await updateEmployee(user, employeeMatch[1], await parseJsonBody(request)), message: "Empleado actualizado correctamente." });
    return true;
  }
  if (employeeMatch && request.method === "DELETE") {
    const user = await requireSession(request);
    const { confirmation } = await parseJsonBody(request);
    sendJson(response, 200, { ...(await deleteEmployee(user, employeeMatch[1], confirmation)), message: "Empleado eliminado correctamente." });
    return true;
  }

  if (route === "/api/records" && request.method === "GET") {
    const user = await requireSession(request);
    sendJson(response, 200, await getDataset(user, Object.fromEntries(requestUrl.searchParams)));
    return true;
  }
  if (route === "/api/records" && request.method === "PUT") {
    const user = await requireSession(request);
    sendJson(response, 200, await saveDataset(user, await parseJsonBody(request)));
    return true;
  }
  if (route === "/api/accounting/reports" && request.method === "GET") {
    const user = await requireSession(request);
    sendJson(response, 200, { report: await getAccountingReport(user, Object.fromEntries(requestUrl.searchParams)) });
    return true;
  }
  return false;
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }
  const requestUrl = new URL(request.url, `http://${request.headers.host || `localhost:${PORT}`}`);
  try {
    if (requestUrl.pathname.startsWith("/api/")) {
      const handled = await handleApi(request, response, requestUrl);
      if (!handled) sendJson(response, 404, { message: "La ruta solicitada no existe." });
      return;
    }
    serveStaticFile(requestUrl, response);
  } catch (error) {
    console.error(`[${request.method}] ${requestUrl.pathname}:`, error.message);
    sendJson(response, error.statusCode || 400, { message: error.message || "No se pudo completar la solicitud." });
  }
}

async function start() {
  await ensureAuthTables();
  await ensureRecordsTable();
  await ensureAccountingTables();
  await ensureEmployeesTable();
  http.createServer(handleRequest).listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error);
  process.exitCode = 1;
});
