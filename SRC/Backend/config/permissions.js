const ROLE_MODULES = Object.freeze({
  Administrador: ["compras", "ventas", "inventarios", "contabilidad", "costos", "reportes"],
  Compras: ["compras"],
  Ventas: ["ventas"],
  Inventarios: ["inventarios"],
  Contabilidad: ["contabilidad", "costos"],
  Empleado: [],
});

function canAccessModule(user, moduleKey) {
  const allowedModules = ROLE_MODULES[user?.role] || [];
  return allowedModules.includes(String(moduleKey || "").trim().toLowerCase());
}

function requireModuleAccess(user, moduleKey) {
  if (canAccessModule(user, moduleKey)) return;
  const error = new Error("No tienes permisos para acceder a este modulo.");
  error.statusCode = 403;
  throw error;
}

module.exports = { ROLE_MODULES, canAccessModule, requireModuleAccess };
