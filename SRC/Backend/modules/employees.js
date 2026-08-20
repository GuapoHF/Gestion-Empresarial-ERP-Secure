const pool = require("../config/connection");
const { cleanText, validateEmailAddress } = require("../config/db");

const EMPLOYEE_ROLES = ["Empleado", "Ventas", "Compras", "Inventarios", "Contabilidad"];
const GENDERS = ["Femenino", "Masculino", "No especificado"];

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertEmployeeAdmin(user) {
  if (!user || user.role !== "Administrador") throw httpError("No tienes permiso para gestionar empleados.", 403);
}

function resolveCompanyId(user, requestedCompanyId) {
  assertEmployeeAdmin(user);
  const companyId = user.isGlobalAdmin && requestedCompanyId ? Number(requestedCompanyId) : Number(user.companyId);
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error("La empresa seleccionada no es valida.");
  return companyId;
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
    identityNumber: row.identity_number || "",
    taxNumber: row.tax_number || "",
    socialSecurityNumber: row.social_security_number || "",
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

  return { firstName, lastName, secondLastName, email, birthDate, birthPlace, gender, identityNumber, taxNumber, socialSecurityNumber, position, branch, systemRole };
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
    identity_number VARCHAR(40) NULL,
    tax_number VARCHAR(40) NULL,
    social_security_number VARCHAR(40) NULL,
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
  const values = [companyId];
  let statusCondition = "status <> 'Eliminado'";
  if (["Activo", "Inactivo"].includes(query.status)) {
    statusCondition = "status = ?";
    values.push(query.status);
  }
  const [rows] = await pool.query(
    `SELECT e.*, c.name company_name FROM employees e JOIN companies c ON c.id = e.company_id
     WHERE e.company_id = ? AND e.${statusCondition} ORDER BY e.first_name, e.last_name`,
    values
  );
  return rows.map(publicEmployee);
}

async function getEmployee(user, id) {
  await ensureEmployeesTable();
  assertEmployeeAdmin(user);
  const [rows] = await pool.query(
    `SELECT e.*, c.name company_name FROM employees e JOIN companies c ON c.id = e.company_id
     WHERE e.id = ? AND e.status <> 'Eliminado' LIMIT 1`,
    [Number(id)]
  );
  if (!rows.length) throw httpError("El empleado no existe o fue eliminado.", 404);
  if (!user.isGlobalAdmin && Number(rows[0].company_id) !== Number(user.companyId)) throw httpError("No puedes consultar empleados de otra empresa.", 403);
  return publicEmployee(rows[0]);
}

async function createEmployee(user, body) {
  await ensureEmployeesTable();
  const companyId = resolveCompanyId(user, body.companyId);
  const company = await getCompany(companyId);
  const valid = validateEmployee(body, company.country_code);
  try {
    const [result] = await pool.query(
      `INSERT INTO employees
       (company_id, first_name, last_name, second_last_name, email, birth_date, birth_place, gender, identity_number,
        tax_number, social_security_number, position, branch, system_role, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, valid.firstName, valid.lastName, valid.secondLastName || null, valid.email, valid.birthDate, valid.birthPlace || null,
       valid.gender, valid.identityNumber || null, valid.taxNumber || null, valid.socialSecurityNumber || null, valid.position,
       valid.branch, valid.systemRole, user.id]
    );
    return getEmployee(user, result.insertId);
  } catch (error) {
    if (error.code === "23505") throw new Error("Ya existe un empleado con ese correo en la empresa.");
    throw error;
  }
}

async function updateEmployee(user, id, body) {
  await ensureEmployeesTable();
  const current = await getEmployee(user, id);
  const company = await getCompany(current.companyId);
  const valid = validateEmployee(body, company.country_code);
  try {
    await pool.query(
      `UPDATE employees SET first_name = ?, last_name = ?, second_last_name = ?, email = ?, birth_date = ?, birth_place = ?,
       gender = ?, identity_number = ?, tax_number = ?, social_security_number = ?, position = ?, branch = ?, system_role = ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status <> 'Eliminado'`,
      [valid.firstName, valid.lastName, valid.secondLastName || null, valid.email, valid.birthDate, valid.birthPlace || null,
       valid.gender, valid.identityNumber || null, valid.taxNumber || null, valid.socialSecurityNumber || null, valid.position,
       valid.branch, valid.systemRole, Number(id)]
    );
    return getEmployee(user, id);
  } catch (error) {
    if (error.code === "23505") throw new Error("Ya existe un empleado con ese correo en la empresa.");
    throw error;
  }
}

async function deleteEmployee(user, id, confirmation) {
  await ensureEmployeesTable();
  const employee = await getEmployee(user, id);
  if (String(confirmation || "").trim().toUpperCase() !== "ELIMINAR") throw new Error("Escribe ELIMINAR para confirmar.");
  const suffix = `${employee.id}-${Date.now()}`;
  const [result] = await pool.query(
    `UPDATE employees SET status = 'Eliminado', email = ?, deleted_by = ?, deleted_at = NOW()
     WHERE id = ? AND status <> 'Eliminado'`,
    [`eliminado+${suffix}@empleados.invalid`, user.id, employee.id]
  );
  if (!result.affectedRows) throw httpError("El empleado ya fue eliminado.", 409);
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
