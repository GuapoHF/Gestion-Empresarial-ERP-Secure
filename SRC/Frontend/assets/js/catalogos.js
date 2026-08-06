const catalogData = {
  categorias: {
    search: "Buscar categoria...",
    button: "+ Nueva Categoria",
    formTitle: "Nueva Categoria",
    formHelp: "Registra una familia de telas para clasificar inventario, compras y ventas.",
    namePlaceholder: "Ej. Gabardina",
    descriptionPlaceholder: "Ej. Tela resistente para uniformes y prendas de trabajo.",
    countLabel: "registros",
    rows: [
      { name: "Algodon", description: "Fibra natural de origen vegetal, alta absorcion.", status: "Activo" },
      { name: "Lino", description: "Tejido natural de lino, fresco y resistente.", status: "Activo" },
      { name: "Poliester", description: "Fibra sintetica, alta durabilidad y facil cuidado.", status: "Activo" },
      { name: "Seda", description: "Fibra natural de alta gama, suave y brillante.", status: "Activo" },
      { name: "Mezclilla", description: "Tela de denim, ideal para prendas casuales y de trabajo.", status: "Activo" },
      { name: "Lana", description: "Fibra animal, excelente para prendas de abrigo.", status: "Activo" },
      { name: "Viscosa", description: "Fibra semisintetica derivada de celulosa de madera.", status: "Inactivo" },
    ],
  },
  unidades: {
    search: "Buscar unidad...",
    button: "+ Nueva Unidad",
    formTitle: "Nueva Unidad",
    formHelp: "Define como se medira o vendera la tela dentro del inventario.",
    namePlaceholder: "Ej. Bobina",
    descriptionPlaceholder: "Ej. Unidad usada para rollos completos de proveedor.",
    countLabel: "registros",
    rows: [
      { name: "Metro", description: "Unidad de longitud estandar internacional.", status: "Activo" },
      { name: "Yarda", description: "Unidad anglosajona equivalente a 0.9144 m.", status: "Activo" },
      { name: "Rollo", description: "Bobina completa de tela, varia entre 40-100 metros.", status: "Activo" },
      { name: "Pieza", description: "Unidad individual de corte o articulo terminado.", status: "Activo" },
      { name: "Kilogramo", description: "Medida de peso para telas vendidas a granel.", status: "Activo" },
    ],
  },
  colores: {
    search: "Buscar color...",
    button: "+ Nuevo Color",
    formTitle: "Nuevo Color",
    formHelp: "Agrega colores usando su codigo HTML para que se identifiquen visualmente.",
    namePlaceholder: "Ej. Verde Oliva",
    descriptionPlaceholder: "Ej. Codigo #556B2F — color para colecciones militares.",
    countLabel: "registros",
    rows: [
      { name: "Blanco Optico", description: "Codigo #F5F5F5 — base estandar para tenido.", status: "Activo", color: "#f5f5f5" },
      { name: "Negro Intenso", description: "Codigo #111111 — tinte de alta fijacion.", status: "Activo", color: "#111111" },
      { name: "Azul Marino", description: "Codigo #1B2A4A — clasico para uniformes y moda.", status: "Activo", color: "#1b2a4a" },
      { name: "Rojo Carmesi", description: "Codigo #B22222 — pigmento de alta saturacion.", status: "Activo", color: "#b22222" },
      { name: "Crudo Natural", description: "Codigo #EDE7D9 — sin blanquear, tono natural.", status: "Activo", color: "#ede7d9" },
      { name: "Gris Oxford", description: "Codigo #6B7280 — gris medio para colecciones.", status: "Inactivo", color: "#6b7280" },
    ],
  },
};

const tabs = document.querySelectorAll("[data-catalog]");
const searchInput = document.querySelector("#catalog-search");
const countLabel = document.querySelector("#catalog-count");
const newButton = document.querySelector("#catalog-new");
const rowsContainer = document.querySelector("#catalog-rows");
const catalogForm = document.querySelector("#catalog-form");
const formTitle = document.querySelector("#catalog-form-title");
const formHelp = document.querySelector("#catalog-form-help");
const nameInput = document.querySelector("#catalog-name");
const descriptionInput = document.querySelector("#catalog-description");
const statusInput = document.querySelector("#catalog-status");
const colorField = document.querySelector("#color-code-field");
const colorInput = document.querySelector("#catalog-color");
const colorPreview = document.querySelector("#color-preview");
const errorMessage = document.querySelector("#catalog-error");
const clearButton = document.querySelector("#catalog-clear");
const cancelButton = document.querySelector("#catalog-cancel");

let activeCatalog = "categorias";
let editIndex = null;

function statusClass(status) {
  return status === "Activo" ? "complete" : "pending";
}

function renderRows() {
  const catalog = catalogData[activeCatalog];
  const term = searchInput.value.trim().toLowerCase();
  const rows = catalog.rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => `${row.name} ${row.description} ${row.status}`.toLowerCase().includes(term));

  countLabel.textContent = `${rows.length} ${catalog.countLabel}`;
  rowsContainer.innerHTML = rows
    .map((row) => {
      const swatch = row.color ? `<i class="color-swatch" style="--swatch:${row.color}"></i>` : "";
      return `
        <div class="catalog-row" data-index="${row.index}">
          <strong>${swatch}${row.name}</strong>
          <span>${row.description}</span>
          <b class="status ${statusClass(row.status)}">${row.status}</b>
          <span class="row-actions">
            <button type="button" data-action="edit"><img src="./assets/icons/inventory-edit.svg" alt="Editar" /></button>
            <button type="button" data-action="delete"><img src="./assets/icons/inventory-delete.svg" alt="Eliminar" /></button>
          </span>
        </div>
      `;
    })
    .join("");
}

function normalizeHex(value) {
  const clean = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
    return clean.toUpperCase();
  }
  return "";
}

function updateColorPreview() {
  const color = normalizeHex(colorInput.value);
  colorPreview.style.setProperty("--swatch", color || "#ffffff");
}

function resetForm() {
  editIndex = null;
  nameInput.value = "";
  descriptionInput.value = "";
  statusInput.value = "Activo";
  colorInput.value = "";
  errorMessage.hidden = true;
  updateColorPreview();
}

function configureForm() {
  const catalog = catalogData[activeCatalog];
  formTitle.textContent = editIndex === null ? catalog.formTitle : `Editar ${catalog.formTitle.replace("Nuevo ", "").replace("Nueva ", "")}`;
  formHelp.textContent = catalog.formHelp;
  nameInput.placeholder = catalog.namePlaceholder;
  descriptionInput.placeholder = catalog.descriptionPlaceholder;
  colorField.hidden = activeCatalog !== "colores";
}

function showForm() {
  configureForm();
  catalogForm.hidden = false;
  nameInput.focus();
}

function hideForm() {
  catalogForm.hidden = true;
  resetForm();
}

function setCatalog(nextCatalog) {
  activeCatalog = nextCatalog;
  const catalog = catalogData[activeCatalog];
  searchInput.value = "";
  searchInput.placeholder = catalog.search;
  newButton.textContent = catalog.button;
  hideForm();

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.catalog === activeCatalog);
  });

  renderRows();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setCatalog(tab.dataset.catalog));
});

searchInput.addEventListener("input", renderRows);
newButton.addEventListener("click", () => {
  resetForm();
  showForm();
});
cancelButton.addEventListener("click", hideForm);
clearButton.addEventListener("click", () => {
  resetForm();
  configureForm();
  nameInput.focus();
});
colorInput.addEventListener("input", updateColorPreview);

rowsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const row = event.target.closest(".catalog-row");
  if (!button || !row) return;

  const index = Number(row.dataset.index);
  if (button.dataset.action === "delete") {
    catalogData[activeCatalog].rows.splice(index, 1);
    renderRows();
    return;
  }

  const currentRow = catalogData[activeCatalog].rows[index];
  editIndex = index;
  nameInput.value = currentRow.name;
  descriptionInput.value = currentRow.description;
  statusInput.value = currentRow.status === "Activo" ? "Activo" : "Inactivo";
  colorInput.value = currentRow.color ? currentRow.color.toUpperCase() : "";
  updateColorPreview();
  showForm();
});

catalogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const description = descriptionInput.value.trim();
  const status = statusInput.value;
  const color = activeCatalog === "colores" ? normalizeHex(colorInput.value) : "";

  if (!name || !description || (activeCatalog === "colores" && !color)) {
    errorMessage.hidden = false;
    return;
  }

  const nextRow = { name, description, status };
  if (activeCatalog === "colores") {
    nextRow.color = color;
    nextRow.description = description.includes("#") ? description : `Codigo ${color} — ${description}`;
  }

  if (editIndex === null) {
    catalogData[activeCatalog].rows.unshift(nextRow);
  } else {
    catalogData[activeCatalog].rows[editIndex] = nextRow;
  }

  hideForm();
  renderRows();
});

setCatalog(activeCatalog);
