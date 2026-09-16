const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { friendlyConnectionError, validateConnectionString } = require("./connection-errors");

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!match || match[2].startsWith("#") || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Falta SUPABASE_DB_URL (o DATABASE_URL). Copia SRC/Backend/.env.example a .env y agrega la URI de Supabase."
  );
}

connectionString = validateConnectionString(connectionString);

const configuredTimeout = Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15_000);
const connectionTimeoutMillis = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? configuredTimeout
  : 15_000;

const pgPool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

function postgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function run(client, sql, values = []) {
  let statement = postgresSql(sql);
  const isInsert = /^\s*INSERT\s+INTO\b/i.test(statement);
  if (isInsert && !/\bRETURNING\b/i.test(statement)) statement += " RETURNING id";
  const result = await client.query(statement, values);
  const metadata = {
    affectedRows: result.rowCount,
    insertId: result.rows[0]?.id,
  };
  return [isInsert ? metadata : result.rows, result.fields];
}

async function connect() {
  try {
    return await pgPool.connect();
  } catch (error) {
    throw friendlyConnectionError(error, connectionString);
  }
}

const pool = {
  query(sql, values) {
    return run(pgPool, sql, values).catch((error) => {
      throw friendlyConnectionError(error, connectionString);
    });
  },
  async getConnection() {
    const client = await connect();
    return {
      query: (sql, values) => run(client, sql, values),
      beginTransaction: () => client.query("BEGIN"),
      commit: () => client.query("COMMIT"),
      rollback: () => client.query("ROLLBACK"),
      release: () => client.release(),
    };
  },
  end() {
    return pgPool.end();
  },
};

module.exports = pool;
