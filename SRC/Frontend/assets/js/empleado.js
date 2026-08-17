const employeeForm = document.querySelector("#employee-form");
const employeeEmail = document.querySelector("#employee-email");
const employeeError = document.querySelector("#employee-form-error");
const employeeCompanyField = document.querySelector("#employee-company-field");
const employeeCompany = document.querySelector("#employee-company");
const employeeCompanyName = document.querySelector("#employee-company-name");
const employeeTitle = document.querySelector("#employee-form-title");
const employeeSave = document.querySelector("#save-employee");
const employeeInitials = document.querySelector("#employee-initials");
const employeeId = new URLSearchParams(window.location.search).get("id");
const employeeUser = window.gestionUserDb.getCurrentUser() || {};
const validation = window.gestionValidation;

let employeeCompanies = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function selectedCompany() {
  const id = employeeUser.isGlobalAdmin ? Number(employeeCompany.value || employeeUser.companyId) : Number(employeeUser.companyId);
  return employeeCompanies.find((company) => Number(company.id) === id) || {
    id,
    name: employeeUser.company,
    countryCode: employeeUser.countryCode,
  };
}

function updateInitials() {
  employeeInitials.textContent = `${employeeForm.elements.firstName.value.charAt(0)}${employeeForm.elements.lastName.value.charAt(0)}`.toUpperCase() || "NE";
}

function applyCountryDocuments() {
  const company = selectedCompany();
  const isMexico = company.countryCode === "MX";
  employeeCompanyName.textContent = company.name;
  const identity = employeeForm.elements.identityNumber;
  const tax = employeeForm.elements.taxNumber;
  const social = employeeForm.elements.socialSecurityNumber;
  document.querySelector('label[for="curp"]').textContent = isMexico ? "CURP" : "DNI / Identidad";
  document.querySelector('label[for="rfc"]').textContent = isMexico ? "RFC" : "RTN";
  document.querySelector('label[for="imss"]').textContent = isMexico ? "IMSS / Seguro Social" : "IHSS / Seguro Social";
  identity.placeholder = isMexico ? "18 caracteres" : "13 digitos";
  tax.placeholder = isMexico ? "12 o 13 caracteres" : "14 digitos";
  social.placeholder = isMexico ? "11 digitos" : "Numero de afiliacion";
  identity.maxLength = isMexico ? 18 : 13;
  tax.maxLength = isMexico ? 13 : 14;
  social.maxLength = isMexico ? 11 : 20;
}

function documentError(countryCode) {
  const identity = employeeForm.elements.identityNumber.value.trim().toUpperCase().replace(/\s+/g, "");
  const tax = employeeForm.elements.taxNumber.value.trim().toUpperCase().replace(/\s+/g, "");
  const social = employeeForm.elements.socialSecurityNumber.value.trim().toUpperCase().replace(/\s+/g, "");
  if (countryCode === "MX") {
    if (identity && !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(identity)) return "La CURP debe contener 18 caracteres validos.";
    if (tax && !/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(tax)) return "El RFC debe contener 12 o 13 caracteres validos.";
    if (social && !/^\d{11}$/.test(social)) return "El numero del IMSS debe contener 11 digitos.";
  } else {
    if (identity && !/^\d{13}$/.test(identity)) return "El DNI debe contener 13 digitos sin guiones.";
    if (tax && !/^\d{14}$/.test(tax)) return "El RTN debe contener 14 digitos sin guiones.";
    if (social && !/^[A-Z0-9-]{7,20}$/.test(social)) return "El numero del IHSS no tiene un formato valido.";
  }
  return "";
}

function populateEmployee(employee) {
  Object.entries({
    firstName: employee.firstName,
    lastName: employee.lastName,
    secondLastName: employee.secondLastName,
    email: employee.email,
    birthDate: employee.birthDate ? String(employee.birthDate).slice(0, 10) : "",
    birthPlace: employee.birthPlace,
    gender: employee.gender,
    identityNumber: employee.identityNumber,
    taxNumber: employee.taxNumber,
    socialSecurityNumber: employee.socialSecurityNumber,
    position: employee.position,
    branch: employee.branch,
    systemRole: employee.systemRole,
  }).forEach(([name, value]) => {
    const field = employeeForm.elements.namedItem(name);
    if (field) field.value = value || "";
  });
  if (employeeUser.isGlobalAdmin) employeeCompany.value = employee.companyId;
  employeeCompany.disabled = true;
  employeeTitle.textContent = "Editar Empleado";
  employeeSave.textContent = "Guardar cambios";
  applyCountryDocuments();
  updateInitials();
}

employeeEmail.addEventListener("blur", () => {
  employeeEmail.value = validation.normalizeEmail(employeeEmail.value);
  validation.setFieldError(employeeEmail, validation.emailError(employeeEmail.value));
});
employeeEmail.addEventListener("input", () => validation.setFieldError(employeeEmail, ""));
employeeForm.elements.firstName.addEventListener("input", updateInitials);
employeeForm.elements.lastName.addEventListener("input", updateInitials);
employeeCompany.addEventListener("change", applyCountryDocuments);

employeeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  employeeError.hidden = true;
  employeeEmail.value = validation.normalizeEmail(employeeEmail.value);
  const emailMessage = validation.emailError(employeeEmail.value);
  validation.setFieldError(employeeEmail, emailMessage);
  if (emailMessage) {
    employeeEmail.focus();
    return;
  }
  if (!employeeForm.checkValidity()) {
    employeeForm.reportValidity();
    return;
  }
  const company = selectedCompany();
  const documentMessage = documentError(company.countryCode);
  if (documentMessage) {
    employeeError.textContent = documentMessage;
    employeeError.hidden = false;
    return;
  }
  const data = Object.fromEntries(new FormData(employeeForm).entries());
  data.companyId = company.id;
  try {
    employeeSave.disabled = true;
    employeeSave.textContent = employeeId ? "Guardando cambios..." : "Registrando...";
    if (employeeId) await window.gestionUserDb.updateEmployee(employeeId, data);
    else await window.gestionUserDb.createEmployee(data);
    sessionStorage.setItem("employeeFlash", employeeId ? "Empleado actualizado correctamente." : "Empleado registrado correctamente.");
    window.location.href = "./empleados.html";
  } catch (error) {
    employeeError.textContent = error.message;
    employeeError.hidden = false;
  } finally {
    employeeSave.disabled = false;
    employeeSave.textContent = employeeId ? "Guardar cambios" : "Guardar empleado";
  }
});

(async function initializeEmployeeForm() {
  try {
    employeeCompanies = await window.gestionUserDb.listCompanies();
    if (employeeUser.isGlobalAdmin) {
      employeeCompany.innerHTML = employeeCompanies.map((company) => `<option value="${company.id}" ${Number(company.id) === Number(employeeUser.companyId) ? "selected" : ""}>${escapeHtml(company.name)}</option>`).join("");
      employeeCompanyField.hidden = false;
    }
    applyCountryDocuments();
    if (employeeId) populateEmployee(await window.gestionUserDb.getEmployee(employeeId));
  } catch (error) {
    employeeError.textContent = error.message;
    employeeError.hidden = false;
    employeeSave.disabled = true;
  }
})();
