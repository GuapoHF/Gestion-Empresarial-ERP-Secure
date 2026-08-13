const http = require("http");
const path = require("path");
const fs = require("fs");
const {
  approveRegistration,
  getPendingRegistrations,
  loginUser,
  rejectRegistration,
  requestRegistration,
  resetPassword,
  sendPasswordRecovery,
} = require("./config/db");

const PORT = process.env.PORT || 3000;
const frontendPath = path.join(__dirname, "..", "Frontend");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(new Error("El cuerpo de la solicitud no contiene JSON valido.")); }
    });
  });
}

function serveStaticFile(request, response) {
  const requestPath = request.url === "/" ? "/login.html" : decodeURIComponent(request.url.split("?")[0]);
  const filePath = path.normalize(path.join(frontendPath, requestPath));

  if (!filePath.startsWith(frontendPath)) {
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
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") { sendJson(response, 204, {}); return; }

  if (request.url === "/api/auth/register" && request.method === "POST") {
    try {
      const registration = await requestRegistration(await parseJsonBody(request));
      sendJson(response, 201, { registration, message: "Solicitud enviada. Un administrador debe autorizar la cuenta." });
    } catch (error) { sendJson(response, 400, { message: error.message }); }
    return;
  }

  if (request.url === "/api/auth/login" && request.method === "POST") {
    try {
      const { username, password } = await parseJsonBody(request);
      const user = await loginUser(username, password);
      if (!user) { sendJson(response, 401, { message: "Usuario o contrasena incorrectos." }); return; }
      sendJson(response, 200, { user });
    } catch (error) { sendJson(response, 400, { message: error.message }); }
    return;
  }
  if (request.url === "/api/auth/recover" && request.method === "POST") {
    try {
      const { email } = await parseJsonBody(request);
      const origin = request.headers.origin || `http://localhost:${PORT}`;
      const result = await sendPasswordRecovery(email, origin);
      sendJson(response, 200, { message: "Correo registrado. Enviamos el enlace de recuperacion.", ...result });
    } catch (error) { sendJson(response, 400, { message: error.message }); }
    return;
  }

  if (request.url === "/api/auth/reset" && request.method === "POST") {
    try {
      const { token, password } = await parseJsonBody(request);
      sendJson(response, 200, { message: "Contrasena actualizada. Ya puedes iniciar sesion.", ...(await resetPassword(token, password)) });
    } catch (error) { sendJson(response, 400, { message: error.message }); }
    return;
  }

  if (request.url === "/api/admin/registrations" && request.method === "GET") {
    try { sendJson(response, 200, { registrations: await getPendingRegistrations() }); }
    catch (error) { sendJson(response, 400, { message: error.message }); }
    return;
  }

  if (request.url === "/api/admin/registrations/approve" && request.method === "POST") {
    try {
      const { id, adminUsername } = await parseJsonBody(request);
      sendJson(response, 200, { user: await approveRegistration(id, adminUsername) });
    } catch (error) { sendJson(response, 400, { message: error.message }); }
    return;
  }

  if (request.url === "/api/admin/registrations/reject" && request.method === "POST") {
    try {
      const { id, adminUsername } = await parseJsonBody(request);
      await rejectRegistration(id, adminUsername);
      sendJson(response, 200, { message: "Solicitud rechazada." });
    } catch (error) { sendJson(response, 400, { message: error.message }); }
    return;
  }

  serveStaticFile(request, response);
}
http.createServer(handleRequest).listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
