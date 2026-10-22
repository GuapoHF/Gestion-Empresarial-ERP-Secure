const pool = require("./connection");
const { sanitizeText } = require("./validator");

let auditTableReady = false;

async function ensureAuditTable() {
  if (auditTableReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS security_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    company_id INT NULL,
    user_id INT NULL,
    action VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    ip_address VARCHAR(80) NULL,
    details_json TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  auditTableReady = true;
}

async function logSecurityEvent({
  companyId = null,
  userId = null,
  action,
  severity = "INFO",
  ipAddress = "local",
  details = {},
}) {
  try {
    await ensureAuditTable();
    const safeAction = sanitizeText(action || "UNKNOWN_EVENT", 80);
    const safeSeverity = ["INFO", "WARN", "HIGH", "CRITICAL"].includes(String(severity).toUpperCase())
      ? String(severity).toUpperCase()
      : "INFO";
    const safeIp = sanitizeText(ipAddress || "local", 80);

    // Sanitizar detalles sin guardar contrasenas ni tokens en texto plano
    const redactedDetails = { ...(details || {}) };
    delete redactedDetails.password;
    delete redactedDetails.passwordHash;
    delete redactedDetails.password_hash;
    delete redactedDetails.token;

    await pool.query(
      `INSERT INTO security_audit_logs (company_id, user_id, action, severity, ip_address, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        companyId ? Number(companyId) : null,
        userId ? Number(userId) : null,
        safeAction,
        safeSeverity,
        safeIp,
        JSON.stringify(redactedDetails).slice(0, 2000),
      ]
    );
  } catch (error) {
    console.warn("[AUDIT_LOG_WARNING] No se pudo registrar evento de auditoria:", error.message);
  }
}

module.exports = {
  ensureAuditTable,
  logSecurityEvent,
};
