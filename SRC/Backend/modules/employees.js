const pool = require("../config/connection");
const { cleanText, validateEmailAddress } = require("../config/db");
const { requireAdminRole, resolveTenantCompanyId } = require("../config/permissions");
const { assertAllowedFields, httpError, parsePagination } = require("../config/validator");
const { blindIndex, decryptField, encryptField } = require("../config/crypto-fields");
const { logSecurityEvent } = require("../config/audit");

const EMPLOYEE_ROLES = ["Empleado", "Ventas", "Compras", "Inventarios", "Contabilidad"];
const GENDERS = ["Femenino", "Masculino", "No especificado"];
const ALLOWED_EMPLOYEE_FIELDS = [
  "companyId",
  "firstName",
  "lastName",
  "secondLastName",
  "email",
  "birthDate",
  "birthPlace",
  "gender",
  "identityNumber",
  "taxNumber",
  "socialSecurityNumber",
  "position",
  "branch",
  "systemRole",
];

const EMPLOYEE_COLUMNS = `
  e.id, e.company_id, e.first_name, e.last_name, e.second_last_name, e.email,
  e.birth_date, e.birth_place, e.gender, e.identity_number, e.tax_number,
  e.social_security_number, e.position, e.branch, e.system_role, e.status,
  e.created_at, e.updated_at, c.name company_name
`;

function resolveCompanyId(user, requestedCompanyId) {
  requireAdminRole(user);
  return resolveTenantCompanyId(user, requestedCompanyId);
}

function safeDecrypt(value) {
  try {
    return decryptField(value);
  } catch {
    return "";
  }
}

function publicEmployee(row) {
  return {
    id: Number(row.id),
    companyId: Number(row.company_id),
    company: row.company_name,
    firstName: row.first_name,
    lastName: row.last_name,
    secondLastName: row.second_last_name || "",
    email: row.email,
    birthDate: row.birth_date,
    birthPlace: row.birth_place || "",
    gender: row.gender,
    identityNumber: safeDecrypt(row.identity_number),
    taxNumber: safeDecrypt(row.tax_number),
    socialSecurityNumber: safeDecrypt(row.social_security_number),
    position: row.position,
    branch: row.branch,
    systemRole: row.system_role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeDocument(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function validateEmployee(body, countryCode) {
  assertAllowedFields(body, ALLOWED_EMPLOYEE_FIELDS, "expediente de empleado");

  const firstName = cleanText(body.firstName);
  const lastName = cleanText(body.lastName);
  const secondLastName = cleanText(body.secondLastName);
  const email = validateEmailAddress(body.email);
  const birthPlace = cleanText(body.birthPlace);
  const position = cleanText(body.position);
  const branch = cleanText(body.branch);
  const gender = cleanText(body.gender) || "No especificado";
  const systemRole = cleanText(body.systemRole) || "Empleado";
  const identityNumber = normalizeDocument(body.identityNumber);
  const taxNumber = normalizeDocument(body.taxNumber);
  const socialSecurityNumber = normalizeDocument(body.socialSecurityNumber);

  if (!firstName || !lastName || !position || !branch) throw new Error("Completa los datos personales y laborales obligatorios.");
  const namePattern = /^[\p{L}][\p{L}\s.'-]{1,79}$/u;
  if (!namePattern.test(firstName) || !namePattern.test(lastName) || (secondLastName && !namePattern.test(secondLastName))) {
    throw new Error("Los nombres y apellidos solo pueden contener letras, espacios, apostrofes o guiones.");
  }
  if (!GENDERS.includes(gender)) throw new Error("Selecciona una opcion valida para sexo.");
  if (!EMPLOYEE_ROLES.includes(systemRole)) throw new Error("Selecciona un area operativa valida.");
  if (position.length > 120 || branch.length > 120 || birthPlace.length > 120) throw new Error("Uno de los textos excede la longitud permitida.");

  let birthDate = null;
  if (body.birthDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(body.birthDate));
    if (!match) throw new Error("La fecha de nacimiento no es valida.");
    const [, year, month, day] = match.map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
      throw new Error("La fecha de nacimiento no es valida.");
    }
    const today = new Date();
    const age = today.getUTCFullYear() - year - (
      today.getUTCMonth() < month - 1 || (today.getUTCMonth() === month - 1 && today.getUTCDate() < day) ? 1 : 0
    );
    if (age < 16 || age > 100) throw new Error("La edad del empleado debe estar entre 16 y 100 anos.");
    birthDate = body.birthDate;
  }

  if (countryCode === "MX") {
    if (identityNumber && !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(identityNumber)) throw new Error("La CURP debe contener 18 caracteres validos.");
    if (taxNumber && !/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(taxNumber)) throw new Error("El RFC debe contener 12 o 13 caracteres validos.");
    if (socialSecurityNumber && !/^\d{11}$/.test(socialSecurityNumber)) throw new Error("El numero del IMSS debe contener 11 digitos.");
  } else {
    if (identityNumber && !/^\d{13}$/.test(identityNumber)) throw new Error("El DNI debe contener 13 digitos sin guiones.");
    if (taxNumber && !/^\d{14}$/.test(taxNumber)) throw new Error("El RTN debe contener 14 digitos sin guiones.");
    if (socialSecurityNumber && !/^[A-Z0-9-]{7,20}$/.test(socialSecurityNumber)) throw new Error("El numero del IHSS no tiene un formato valido.");
  }

  return {
    firstName,
    lastName,
    secondLastName,
    email,
    birthDate,
    birthPlace,
    gender,
    identityNumber,
    taxNumber,
    socialSecurityNumber,
    position,
    branch,
    systemRole,
  };
}

async function ensureEmployeesTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL,
    seed_key VARCHAR(80) NULL,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    second_last_name VARCHAR(120) NULL,
    email VARCHAR(180) NOT NULL,
    birth_date DATE NULL,
    birth_place VARCHAR(120) NULL,
    gender VARCHAR(30) NOT NULL DEFAULT 'No especificado',
    identity_number VARCHAR(255) NULL,
    tax_number VARCHAR(255) NULL,
    social_security_number VARCHAR(255) NULL,
    identity_blind_index VARCHAR(100) NULL,
    position VARCHAR(120) NOT NULL,
    branch VARCHAR(120) NOT NULL,
    system_role VARCHAR(40) NOT NULL DEFAULT 'Empleado',
    status VARCHAR(30) NOT NULL DEFAULT 'Activo',
    created_by INT NULL,
    deleted_by INT NULL,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_employee_email_company UNIQUE (company_id, email),
    CONSTRAINT uq_employee_seed_company UNIQUE (company_id, seed_key)
  )`);

  await pool.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS identity_blind_index VARCHAR(100) NULL").catch(() => {});
  await pool.query("ALTER TABLE employees ALTER COLUMN identity_number TYPE VARCHAR(255)").catch(() => {});
  await pool.query("ALTER TABLE employees ALTER COLUMN tax_number TYPE VARCHAR(255)").catch(() => {});
  await pool.query("ALTER TABLE employees ALTER COLUMN social_security_number TYPE VARCHAR(255)").catch(() => {});

  const [companies] = await pool.query("SELECT id, code, country_code FROM companies WHERE active = 1");
  const seeds = [
    ["mariana", "Mariana", "Lopez", "Rivera", "Encargada de Inventario Textil", "Bodega Central", "Inventarios"],
    ["carlos", "Carlos", "Mejia", "", "Asesor de Ventas de Telas", "Sucursal Principal", "Ventas"],
    ["ana", "Ana", "Ruiz", "", "Contadora General", "Oficina Central", "Contabilidad"],
  ];
  for (const company of companies) {
    const domain = company.code === "TELAS_OLIMPICA_MX" ? "telasolimpica.mx" : company.code === "GRUPO_CIRSA_HN" ? "grupocirsa.hn" : "vicmar.hn";
    for (const [seedKey, firstName, lastName, secondLastName, position, branch, role] of seeds) {
      await pool.query(
        `INSERT INTO employees
         (company_id, seed_key, first_name, last_name, second_last_name, email, position, branch, system_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (company_id, seed_key) DO NOTHING`,
        [company.id, seedKey, firstName, lastName, secondLastName || null, `${seedKey}@${domain}`, position, branch, role]
      );
    }
  }
}

async function getCompany(companyId) {
  const [rows] = await pool.query("SELECT id, name, country_code FROM companies WHERE id = ? AND active = 1 LIMIT 1", [companyId]);
  if (!rows.length) throw new Error("La empresa seleccionada no esta disponible.");
  return rows[0];
}

async function listEmployees(user, query = {}) {
  await ensureEmployeesTable();
  const companyId = resolveCompanyId(user, query.companyId);
  await getCompany(companyId);
  const { limit, offset } = parsePagination(query, 100, 500);
  const values = [companyId];
  let statusCondition = "status <> 'Eliminado'";
  if (["Activo", "Inactivo"].includes(query.status)) {
    statusCondition = "status = ?";
    values.push(query.status);
  }
  values.push(limit, offset);
  const [rows] = await pool.query(
    `SELECT ${EMPLOYEE_COLUMNS}
     FROM employees e
     JOIN companies c ON c.id = e.company_id
     WHERE e.company_id = ? AND e.${statusCondition}
     ORDER BY e.first_name, e.last_name
     LIMIT ? OFFSET ?`,
    values
  );
  return rows.map(publicEmployee);
}

async function getEmployee(user, id) {
  await ensureEmployeesTable();
  requireAdminRole(user);
  const [rows] = await pool.query(
    `SELECT ${EMPLOYEE_COLUMNS}
     FROM employees e
     JOIN companies c ON c.id = e.company_id
     WHERE e.id = ? AND e.status <> 'Eliminado' LIMIT 1`,
    [Number(id)]
  );
  if (!rows.length) throw httpError("El empleado no existe o fue eliminado.", 404);
  if (!user.isGlobalAdmin && Number(rows[0].company_id) !== Number(user.companyId)) {
    await logSecurityEvent({
      companyId: user.companyId,
      userId: user.id,
      action: "IDOR_ATTEMPT_BLOCKED",
      severity: "HIGH",
      details: { targetEmployeeId: Number(id), targetCompanyId: rows[0].company_id },
    });
    throw httpError("Acceso denegado (Anti-IDOR): no puedes consultar empleados de otra empresa.", 403);
  }
  return publicEmployee(rows[0]);
}

async function createEmployee(user, body, ipAddress = "local") {
  await ensureEmployeesTable();
  const companyId = resolveCompanyId(user, body?.companyId);
  const company = await getCompany(companyId);
  const valid = validateEmployee(body, company.country_code);

  const encryptedIdentity = valid.identityNumber ? encryptField(valid.identityNumber) : null;
  const encryptedTax = valid.taxNumber ? encryptField(valid.taxNumber) : null;
  const encryptedSsn = valid.socialSecurityNumber ? encryptField(valid.socialSecurityNumber) : null;
  const identityIndex = valid.identityNumber ? blindIndex(valid.identityNumber) : null;

  try {
    const [result] = await pool.query(
      `INSERT INTO employees
       (company_id, first_name, last_name, second_last_name, email, birth_date, birth_place, gender, identity_number,
        tax_number, social_security_number, identity_blind_index, position, branch, system_role, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        valid.firstName,
        valid.lastName,
        valid.secondLastName || null,
        valid.email,
        valid.birthDate,
        valid.birthPlace || null,
        valid.gender,
        encryptedIdentity,
        encryptedTax,
        encryptedSsn,
        identityIndex,
        valid.position,
        valid.branch,
        valid.systemRole,
        user.id,
      ]
    );
    await logSecurityEvent({
      companyId,
      userId: user.id,
      action: "EMPLOYEE_CREATED",
      severity: "INFO",
      ipAddress,
      details: { employeeId: result.insertId, email: valid.email },
    });
    return getEmployee(user, result.insertId);
  } catch (error) {
    if (error.code === "23505") throw new Error("Ya existe un empleado con ese correo en la empresa.");
    throw error;
  }
}

async function updateEmployee(user, id, body, ipAddress = "local") {
  await ensureEmployeesTable();
  const current = await getEmployee(user, id);
  const company = await getCompany(current.companyId);
  const valid = validateEmployee(body, company.country_code);

  const encryptedIdentity = valid.identityNumber ? encryptField(valid.identityNumber) : null;
  const encryptedTax = valid.taxNumber ? encryptField(valid.taxNumber) : null;
  const encryptedSsn = valid.socialSecurityNumber ? encryptField(valid.socialSecurityNumber) : null;
  const identityIndex = valid.identityNumber ? blindIndex(valid.identityNumber) : null;

  try {
    await pool.query(
      `UPDATE employees SET first_name = ?, last_name = ?, second_last_name = ?, email = ?, birth_date = ?, birth_place = ?,
       gender = ?, identity_number = ?, tax_number = ?, social_security_number = ?, identity_blind_index = ?,
       position = ?, branch = ?, system_role = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ? AND status <> 'Eliminado'`,
      [
        valid.firstName,
        valid.lastName,
        valid.secondLastName || null,
        valid.email,
        valid.birthDate,
        valid.birthPlace || null,
        valid.gender,
        encryptedIdentity,
        encryptedTax,
        encryptedSsn,
        identityIndex,
        valid.position,
        valid.branch,
        valid.systemRole,
        Number(id),
        current.companyId,
      ]
    );
    await logSecurityEvent({
      companyId: current.companyId,
      userId: user.id,
      action: "EMPLOYEE_UPDATED",
      severity: "INFO",
      ipAddress,
      details: { employeeId: Number(id), email: valid.email },
    });
    return getEmployee(user, id);
  } catch (error) {
    if (error.code === "23505") throw new Error("Ya existe un empleado con ese correo en la empresa.");
    throw error;
  }
}

async function deleteEmployee(user, id, confirmation, ipAddress = "local") {
  await ensureEmployeesTable();
  const employee = await getEmployee(user, id);
  if (String(confirmation || "").trim().toUpperCase() !== "ELIMINAR") throw new Error("Escribe ELIMINAR para confirmar.");
  const suffix = `${employee.id}-${Date.now()}`;
  const [result] = await pool.query(
    `UPDATE employees SET status = 'Eliminado', email = ?, deleted_by = ?, deleted_at = NOW()
     WHERE id = ? AND company_id = ? AND status <> 'Eliminado'`,
    [`eliminado+${suffix}@empleados.invalid`, user.id, employee.id, employee.companyId]
  );
  if (!result.affectedRows) throw httpError("El empleado ya fue eliminado.", 409);
  await logSecurityEvent({
    companyId: employee.companyId,
    userId: user.id,
    action: "EMPLOYEE_DELETED",
    severity: "WARN",
    ipAddress,
    details: { employeeId: employee.id },
  });
  return { deleted: true, id: employee.id };
}

module.exports = {
  createEmployee,
  deleteEmployee,
  ensureEmployeesTable,
  getEmployee,
  listEmployees,
  updateEmployee,
};
