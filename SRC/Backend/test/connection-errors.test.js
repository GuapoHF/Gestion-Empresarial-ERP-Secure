const test = require("node:test");
const assert = require("node:assert/strict");
const { friendlyConnectionError, validateConnectionString } = require("../config/connection-errors");

test("acepta una URI PostgreSQL completa", () => {
  const uri = "postgresql://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
  assert.equal(validateConnectionString(uri), uri);
});

test("rechaza los marcadores de la URI de ejemplo", () => {
  assert.throws(
    () => validateConnectionString("postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"),
    /marcadores de ejemplo/
  );
});

test("convierte un timeout en un diagnostico util sin exponer credenciales", () => {
  const uri = "postgresql://usuario:secreto@db.example.com:5432/postgres";
  const result = friendlyConnectionError(new Error("Connection terminated due to connection timeout"), uri);

  assert.equal(result.code, "DB_CONNECTION_TIMEOUT");
  assert.match(result.message, /db\.example\.com:5432/);
  assert.match(result.message, /Transaction pooler/);
  assert.doesNotMatch(result.message, /secreto/);
});

test("conserva los errores que no son de conectividad", () => {
  const original = new Error("password authentication failed");
  assert.equal(friendlyConnectionError(original, "postgresql://user:pass@host/db"), original);
});
