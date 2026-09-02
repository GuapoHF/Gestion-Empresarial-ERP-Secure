const pool = require("../config/connection");
const { requireModuleAccess } = require("../config/permissions");

const KEY_PATTERN = /^[a-z0-9_-]{2,40}$/;

function validateKey(value, label) {
  const key = String(value || "").trim().toLowerCase();
  if (!KEY_PATTERN.test(key)) throw new Error(`${label} no es valido.`);
  return key;
}

function resolveCompanyId(user, requestedCompanyId) {
  const companyId = user.isGlobalAdmin && requestedCompanyId ? Number(requestedCompanyId) : Number(user.companyId);
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error("La empresa seleccionada no es valida.");
  return companyId;
}

async function assertActiveCompany(companyId) {
  const [companies] = await pool.query("SELECT id FROM companies WHERE id = ? AND active = 1 LIMIT 1", [companyId]);
  if (!companies.length) throw new Error("La empresa seleccionada no esta disponible.");
}

async function ensureRecordsTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS business_datasets (
    id BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL,
    module_key VARCHAR(40) NOT NULL,
    view_key VARCHAR(40) NOT NULL,
    rows_json TEXT NOT NULL,
    updated_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_business_dataset UNIQUE (company_id, module_key, view_key)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS business_serial_sequences (
    company_id INT NOT NULL, module_key VARCHAR(40) NOT NULL, view_key VARCHAR(40) NOT NULL,
    next_value BIGINT NOT NULL DEFAULT 1, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (company_id, module_key, view_key)
  )`);
}

function serialPrefix(moduleKey, viewKey) {
  const part = (value) => value.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  return `SER-${part(moduleKey)}-${part(viewKey)}-`;
}

async function assignSerialNumbers(connection, companyId, moduleKey, viewKey, rows) {
  const prefix = serialPrefix(moduleKey, viewKey);
  await connection.query(
    `INSERT INTO business_serial_sequences (company_id, module_key, view_key, next_value)
     VALUES (?, ?, ?, 1) ON CONFLICT (company_id, module_key, view_key) DO NOTHING RETURNING next_value`,
    [companyId, moduleKey, viewKey]
  );
  const [sequences] = await connection.query(
    `SELECT next_value FROM business_serial_sequences
     WHERE company_id = ? AND module_key = ? AND view_key = ? FOR UPDATE`,
    [companyId, moduleKey, viewKey]
  );
  let nextValue = Number(sequences[0].next_value);
  const used = new Set();
  const numberedRows = rows.map((row) => {
    const values = [...row];
    const candidate = String(values.at(-1) || "");
    if (new RegExp(`^${prefix}\\d{6,}$`).test(candidate) && !used.has(candidate)) {
      used.add(candidate);
      const value = Number(candidate.slice(prefix.length));
      if (Number.isSafeInteger(value)) nextValue = Math.max(nextValue, value + 1);
      return values;
    }
    const serial = `${prefix}${String(nextValue).padStart(6, "0")}`;
    nextValue += 1;
    used.add(serial);
    if (candidate === "Asignando...") values.pop();
    values.push(serial);
    return values;
  });
  await connection.query(
    `UPDATE business_serial_sequences SET next_value = ?, updated_at = CURRENT_TIMESTAMP
     WHERE company_id = ? AND module_key = ? AND view_key = ?`,
    [nextValue, companyId, moduleKey, viewKey]
  );
  return numberedRows;
}

async function getDataset(user, query) {
  await ensureRecordsTable();
  const moduleKey = validateKey(query.module, "El modulo");
  requireModuleAccess(user, moduleKey);
  const viewKey = validateKey(query.view, "La vista");
  const companyId = resolveCompanyId(user, query.companyId);
  await assertActiveCompany(companyId);
  const [rows] = await pool.query(
    "SELECT rows_json, updated_at FROM business_datasets WHERE company_id = ? AND module_key = ? AND view_key = ? LIMIT 1",
    [companyId, moduleKey, viewKey]
  );
  if (!rows.length) return { initialized: false, rows: [], companyId };
  let data = [];
  try { data = JSON.parse(rows[0].rows_json); } catch (error) { data = []; }
  return { initialized: true, rows: Array.isArray(data) ? data : [], companyId, updatedAt: rows[0].updated_at };
}

async function saveDataset(user, body) {
  await ensureRecordsTable();
  const moduleKey = validateKey(body.moduleKey, "El modulo");
  requireModuleAccess(user, moduleKey);
  const viewKey = validateKey(body.viewKey, "La vista");
  const companyId = resolveCompanyId(user, body.companyId);
  await assertActiveCompany(companyId);
  if (!Array.isArray(body.rows) || body.rows.length > 2000) throw new Error("El conjunto de registros no es valido.");
  const submittedRows = body.rows.map((row) => {
    if (!Array.isArray(row) || row.length > 30) throw new Error("Uno de los registros no tiene el formato esperado.");
    return row.map((value) => String(value ?? "").slice(0, 500));
  });
  const connection = await pool.getConnection();
  let rows;
  try {
    await connection.beginTransaction();
    rows = await assignSerialNumbers(connection, companyId, moduleKey, viewKey, submittedRows);
    await connection.query(
      `INSERT INTO business_datasets (company_id, module_key, view_key, rows_json, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (company_id, module_key, view_key) DO UPDATE
       SET rows_json = EXCLUDED.rows_json, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
      [companyId, moduleKey, viewKey, JSON.stringify(rows), user.id]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return { saved: true, companyId, rows };
}

module.exports = { ensureRecordsTable, getDataset, saveDataset };
