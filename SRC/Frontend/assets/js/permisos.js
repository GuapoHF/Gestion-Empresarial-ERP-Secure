const employeeListContainer = document.querySelector("#permission-employee-list");
const employeeTitle = document.querySelector("#permission-employee-title");
const employeeSubtitle = document.querySelector("#permission-employee-subtitle");
const roleSelect = document.querySelector("#permission-role-select");
const saveButton = document.querySelector("#permission-save-btn");
const matrixRowsContainer = document.querySelector("#permission-matrix-rows");
const toast = document.querySelector("#permission-toast");

const MODULE_DEFINITIONS = [
  { key: "inventarios", label: "Inventarios de Rollos, Lotes y Kardex" },
  { key: "compras", label: "Compras, Importaciones y Proveedores Textiles" },
  { key: "ventas", label: "Facturacion, Proformas, Pedidos y POS" },
  { key: "contabilidad", label: "Contabilidad, Bancos y Estados Financieros" },
  { key: "costos", label: "Analisis de Costos y Margenes por Tela" },
];

const ROLE_CAPABILITIES = {
  Administrador: {
    inventarios: [true, true, true, true],
    compras: [true, true, true, true],
    ventas: [true, true, true, true],
    contabilidad: [true, true, true, true],
    costos: [true, true, true, true],
  },
  Inventarios: {
    inventarios: [true, true, true, false],
    compras: [false, false, false, false],
    ventas: [false, false, false, false],
    contabilidad: [false, false, false, false],
    costos: [false, false, false, false],
  },
  Compras: {
    inventarios: [false, false, false, false],
    compras: [true, true, true, false],
    ventas: [false, false, false, false],
    contabilidad: [false, false, false, false],
    costos: [false, false, false, false],
  },
  Ventas: {
    inventarios: [false, false, false, false],
    compras: [false, false, false, false],
    ventas: [true, true, true, false],
    contabilidad: [false, false, false, false],
    costos: [false, false, false, false],
  },
  Contabilidad: {
    inventarios: [false, false, false, false],
    compras: [false, false, false, false],
    ventas: [false, false, false, false],
    contabilidad: [true, true, true, false],
    costos: [true, true, true, false],
  },
  Empleado: {
    inventarios: [false, false, false, false],
    compras: [false, false, false, false],
    ventas: [false, false, false, false],
    contabilidad: [false, false, false, false],
    costos: [false, false, false, false],
  },
};

let employees = [];
let selectedEmployee = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

function showToast(message, isError = false) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("error", Boolean(isError));
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function renderMatrixForRole(roleName) {
  const capabilities = ROLE_CAPABILITIES[roleName] || ROLE_CAPABILITIES.Empleado;
  matrixRowsContainer.innerHTML = MODULE_DEFINITIONS.map((mod) => {
    const flags = capabilities[mod.key] || [false, false, false, false];
    const cells = flags
      .map((enabled) => `<span class="status ${enabled ? "complete" : "pending"}">${enabled ? "Permitido" : "Restringido"}</span>`)
      .join("");
    return `<div class="matrix-row"><strong>${escapeHtml(mod.label)}</strong>${cells}</div>`;
  }).join("");
}

function renderEmployeeList() {
  if (!employees.length) {
    employeeListContainer.innerHTML = '<p class="employee-empty">No hay empleados activos en esta empresa.</p>';
    employeeTitle.textContent = "Sin personal seleccionado";
    employeeSubtitle.textContent = "Registra empleados en Gestion de Empleados para asignarles un rol operativo.";
    roleSelect.disabled = true;
    saveButton.disabled = true;
    renderMatrixForRole("Empleado");
    return;
  }

  employeeListContainer.innerHTML = employees
    .map((emp) => {
      const fullName = [emp.firstName, emp.lastName, emp.secondLastName].filter(Boolean).join(" ");
      const isActive = selectedEmployee && selectedEmployee.id === emp.id;
      return `<button class="${isActive ? "active" : ""}" type="button" data-employee-id="${emp.id}">
        <strong>${escapeHtml(fullName)}</strong>
        <span>${escapeHtml(emp.position)} · ${escapeHtml(emp.systemRole)}</span>
      </button>`;
    })
    .join("");
}

function selectEmployee(emp) {
  selectedEmployee = emp;
  const fullName = [emp.firstName, emp.lastName, emp.secondLastName].filter(Boolean).join(" ");
  employeeTitle.textContent = `Privilegios de ${fullName}`;
  employeeSubtitle.textContent = `${emp.position} (${emp.branch}) — ${emp.email}`;
  roleSelect.value = emp.systemRole || "Empleado";
  roleSelect.disabled = false;
  saveButton.disabled = false;
  renderEmployeeList();
  renderMatrixForRole(roleSelect.value);
}

employeeListContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-employee-id]");
  if (!button) return;
  const emp = employees.find((item) => item.id === Number(button.dataset.employeeId));
  if (emp) selectEmployee(emp);
});

roleSelect.addEventListener("change", () => {
  renderMatrixForRole(roleSelect.value);
});

saveButton.addEventListener("click", async () => {
  if (!selectedEmployee) return;
  saveButton.disabled = true;
  saveButton.textContent = "Guardando...";
  try {
    const detailed = await window.gestionUserDb.getEmployee(selectedEmployee.id);
    const updated = await window.gestionUserDb.updateEmployee(selectedEmployee.id, {
      firstName: detailed.firstName,
      lastName: detailed.lastName,
      secondLastName: detailed.secondLastName || "",
      email: detailed.email,
      birthDate: detailed.birthDate ? String(detailed.birthDate).slice(0, 10) : "",
      birthPlace: detailed.birthPlace || "",
      gender: detailed.gender || "No especificado",
      identityNumber: detailed.identityNumber || "",
      taxNumber: detailed.taxNumber || "",
      socialSecurityNumber: detailed.socialSecurityNumber || "",
      position: detailed.position,
      branch: detailed.branch,
      systemRole: roleSelect.value,
    });
    const idx = employees.findIndex((item) => item.id === updated.id);
    if (idx >= 0) employees[idx] = updated;
    selectEmployee(updated);
    showToast(`Rol operativo de ${updated.firstName} ${updated.lastName} actualizado a ${updated.systemRole}.`);
  } catch (error) {
    showToast(error.message || "No se pudo actualizar el rol del empleado.", true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Guardar rol";
  }
});

(async function initPermissions() {
  renderMatrixForRole("Empleado");
  try {
    employees = await window.gestionUserDb.listEmployees({ status: "Activo" });
    if (employees.length) {
      selectEmployee(employees[0]);
    } else {
      renderEmployeeList();
    }
  } catch (error) {
    employeeListContainer.innerHTML = `<p class="employee-empty">${escapeHtml(error.message)}</p>`;
  }
})();
