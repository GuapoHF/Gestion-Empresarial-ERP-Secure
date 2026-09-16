function databaseTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    return `${url.hostname}:${url.port || "5432"}`;
  } catch {
    return "el servidor configurado";
  }
}

function validateConnectionString(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("SUPABASE_DB_URL no es una URI valida de PostgreSQL.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("SUPABASE_DB_URL debe comenzar con postgresql:// (o postgres://).");
  }
  if (!url.hostname || !url.username || !url.pathname || url.pathname === "/") {
    throw new Error("SUPABASE_DB_URL esta incompleta. Copia nuevamente la URI desde Supabase.");
  }
  if (/PROJECT_REF|PASSWORD|REGION|CONTRASENA/i.test(connectionString)) {
    throw new Error("SUPABASE_DB_URL aun contiene marcadores de ejemplo. Reemplazalos con los datos reales de Supabase.");
  }
  return connectionString;
}

function friendlyConnectionError(error, connectionString) {
  const message = String(error?.message || "");
  const code = error?.code || error?.cause?.code;
  const timedOut = code === "ETIMEDOUT" || /timeout|terminated unexpectedly/i.test(message);

  if (!timedOut) return error;

  const target = databaseTarget(connectionString);
  const friendly = new Error(
    `No fue posible comunicarse con PostgreSQL en ${target}. ` +
    "Verifica que el proyecto de Supabase este activo y copia la URI de Transaction pooler " +
    "(puerto 6543) desde Connect > Connection string; esa opcion funciona en redes IPv4. " +
    "Revisa tambien el host, la region y tu conexion a Internet."
  );
  friendly.code = "DB_CONNECTION_TIMEOUT";
  friendly.cause = error;
  return friendly;
}

module.exports = { friendlyConnectionError, validateConnectionString };
