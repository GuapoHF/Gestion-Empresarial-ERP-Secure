const ROLE_MODULES = Object.freeze({
  Administrador: ["compras", "ventas", "inventarios", "contabilidad", "costos", "reportes", "pos", "ayuda", "administrador"],
  Compras: ["compras", "inventarios", "ayuda"],
  Ventas: ["ventas", "pos", "ayuda"],
  Inventarios: ["inventarios", "compras", "ayuda"],
  Contabilidad: ["contabilidad", "costos", "reportes", "ayuda"],
  Finanzas: ["contabilidad", "costos", "reportes", "pos", "ayuda"],
  Empleado: ["ayuda"],
});

function httpForbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function canAccessModule(userOrRole, moduleKey) {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  const allowedModules = ROLE_MODULES[role] || [];
  return allowedModules.includes(String(moduleKey || "").trim().toLowerCase());
}

function requireModuleAccess(user, moduleKey) {
  if (canAccessModule(user, moduleKey)) return;
  throw httpForbidden("No tienes permisos para acceder a este modulo.");
}

function requireAdminRole(user) {
  if (!user || user.role !== "Administrador") {
    throw httpForbidden("Se requiere rol de Administrador para realizar esta operacion.");
  }
}

function requireGlobalAdminRole(user) {
  if (!user || !user.isGlobalAdmin || user.role !== "Administrador") {
    throw httpForbidden("Solo el administrador global puede ejecutar esta accion.");
  }
}

function resolveTenantCompanyId(user, requestedCompanyId) {
  if (!user || !Number.isInteger(Number(user.companyId)) || Number(user.companyId) <= 0) {
    const error = new Error("Sesion de usuario invalida o sin empresa asignada.");
    error.statusCode = 401;
    throw error;
  }

  const ownCompanyId = Number(user.companyId);
  if (requestedCompanyId === undefined || requestedCompanyId === null || requestedCompanyId === "") {
    return ownCompanyId;
  }

  const targetCompanyId = Number(requestedCompanyId);
  if (!Number.isInteger(targetCompanyId) || targetCompanyId <= 0) {
    const error = new Error("La empresa seleccionada no es valida.");
    error.statusCode = 400;
    throw error;
  }

  if (targetCompanyId !== ownCompanyId) {
    if (!user.isGlobalAdmin || user.role !== "Administrador") {
      throw httpForbidden("Acceso denegado (Anti-IDOR): no tienes autorizacion para acceder a registros de otra empresa.");
    }
  }

  return targetCompanyId;
}

module.exports = {
  ROLE_MODULES,
  canAccessModule,
  requireAdminRole,
  requireGlobalAdminRole,
  requireModuleAccess,
  resolveTenantCompanyId,
};
