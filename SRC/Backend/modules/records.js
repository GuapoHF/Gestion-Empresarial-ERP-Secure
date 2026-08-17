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
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    module_key VARCHAR(40) NOT NULL,
    view_key VARCHAR(40) NOT NULL,
    rows_json LONGTEXT NOT NULL,
    updated_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_business_dataset (company_id, module_key, view_key)
  )`);
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
  const rows = body.rows.map((row) => {
    if (!Array.isArray(row) || row.length > 30) throw new Error("Uno de los registros no tiene el formato esperado.");
    return row.map((value) => String(value ?? "").slice(0, 500));
  });
  await pool.query(
    `INSERT INTO business_datasets (company_id, module_key, view_key, rows_json, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rows_json = VALUES(rows_json), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
    [companyId, moduleKey, viewKey, JSON.stringify(rows), user.id]
  );
  return { saved: true, companyId, rows };
}

module.exports = { ensureRecordsTable, getDataset, saveDataset };
