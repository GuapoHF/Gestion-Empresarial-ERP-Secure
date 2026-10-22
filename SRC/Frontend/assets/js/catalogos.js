const catalogData = {
  categorias: {
    search: "Buscar categoria de tela...",
    button: "+ Nueva Categoria",
    formTitle: "Nueva Categoria",
    formHelp: "Registra una familia de telas para clasificar rollos, lotes, compras y ventas.",
    namePlaceholder: "Ej. Gabardina",
    descriptionPlaceholder: "Ej. Sarga de algodon/poliester resistente para uniformes e indumentaria.",
    countLabel: "registros",
    rows: [
      { name: "Algodon", description: "Fibra natural de origen vegetal, alta absorcion y transpirabilidad.", status: "Activo", serial: "SER-INV-CAT-000001" },
      { name: "Lino", description: "Tejido natural de lino, fresco y de alta resistencia a la traccion.", status: "Activo", serial: "SER-INV-CAT-000002" },
      { name: "Poliester", description: "Fibra sintetica de alta durabilidad, retencion de color y facil cuidado.", status: "Activo", serial: "SER-INV-CAT-000003" },
      { name: "Seda", description: "Fibra proteica natural de alta gama, tacto suave y brillo natural.", status: "Activo", serial: "SER-INV-CAT-000004" },
      { name: "Mezclilla", description: "Tejido denim en sarga de algodon de 10 a 14 oz para confeccion pesada.", status: "Activo", serial: "SER-INV-CAT-000005" },
      { name: "Gabardina", description: "Tejido diagonal estructurado para uniformes corporativos y escolares.", status: "Activo", serial: "SER-INV-CAT-000006" },
      { name: "Popelina", description: "Tejido plano ligero para camiseria y blancos institucionales.", status: "Activo", serial: "SER-INV-CAT-000007" },
    ],
  },
  unidades: {
    search: "Buscar unidad de medida...",
    button: "+ Nueva Unidad",
    formTitle: "Nueva Unidad",
    formHelp: "Define como se cuantifica y comercializa la tela en almacenes y facturacion.",
    namePlaceholder: "Ej. Fardo",
    descriptionPlaceholder: "Ej. Empaque mayorista de rollos prensados para importacion.",
    countLabel: "registros",
    rows: [
      { name: "Metro", description: "Unidad lineal estandar para corte de mostrador y confeccion.", status: "Activo", serial: "SER-INV-UNI-000001" },
      { name: "Yarda", description: "Unidad lineal equivalente a 0.9144 metros para importacion textil.", status: "Activo", serial: "SER-INV-UNI-000002" },
      { name: "Rollo", description: "Bobina cerrada de fabrica (40 a 100 metros lineales segun gramaje).", status: "Activo", serial: "SER-INV-UNI-000003" },
      { name: "Fardo", description: "Lote mayorista de rollos o piezas embaladas de origen.", status: "Activo", serial: "SER-INV-UNI-000004" },
      { name: "Kilogramo", description: "Medida ponderal para tejido de punto, rib y remates por peso.", status: "Activo", serial: "SER-INV-UNI-000005" },
    ],
  },
  colores: {
    search: "Buscar tono o codigo hexadecimal...",
    button: "+ Nuevo Color",
    formTitle: "Nuevo Color",
    formHelp: "Registra tonos textiles con su muestra hexadecimal para control de lotes de tenido.",
    namePlaceholder: "Ej. Verde Oliva",
    descriptionPlaceholder: "Ej. Codigo #556B2F — tenido reactivo para linea institucional.",
    countLabel: "registros",
    rows: [
      { name: "Blanco Optico", description: "Codigo #F5F5F5 — base blanqueada estandar para camiseria.", status: "Activo", color: "#F5F5F5", serial: "SER-INV-COL-000001" },
      { name: "Negro Intenso", description: "Codigo #111111 — tenido de alta fijacion y solidez al lavado.", status: "Activo", color: "#111111", serial: "SER-INV-COL-000002" },
      { name: "Azul Marino", description: "Codigo #1B2A4A — tono institucional para gabardina y uniformes.", status: "Activo", color: "#1B2A4A", serial: "SER-INV-COL-000003" },
      { name: "Rojo Carmesi", description: "Codigo #B22222 — pigmento intenso para satines y forros.", status: "Activo", color: "#B22222", serial: "SER-INV-COL-000004" },
      { name: "Crudo Natural", description: "Codigo #EDE7D9 — manta y lino sin blanquear en tono fibra natural.", status: "Activo", color: "#EDE7D9", serial: "SER-INV-COL-000005" },
      { name: "Gris Oxford", description: "Codigo #6B7280 — tono neutro jaspeado para sastreria y pantalones.", status: "Activo", color: "#6B7280", serial: "SER-INV-COL-000006" },
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
const submitButton = document.querySelector("#catalog-submit");
const toast = document.querySelector("#catalog-toast");

let activeCatalog = "categorias";
let editIndex = null;

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
  }, 3000);
}

function statusClass(status) {
  return status === "Activo" ? "complete" : "pending";
}

function normalizeHex(value) {
  const clean = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
    return clean.toUpperCase();
  }
  return "";
}

function serializeCatalogRows(catalogKey) {
  return catalogData[catalogKey].rows.map((item) => [
    item.name,
    item.description,
    item.status,
    item.color || "",
    item.serial || "Asignando...",
  ]);
}

function deserializeCatalogRows(rawRows) {
  return rawRows.map((arr) => ({
    name: String(arr[0] || ""),
    description: String(arr[1] || ""),
    status: arr[2] === "Inactivo" ? "Inactivo" : "Activo",
    color: normalizeHex(arr[3] || ""),
    serial: String(arr[4] || arr.at(-1) || ""),
  }));
}

async function syncCatalog(catalogKey) {
  try {
    const dataset = await window.gestionUserDb.getDataset("inventarios", catalogKey);
    if (dataset.initialized && Array.isArray(dataset.rows)) {
      catalogData[catalogKey].rows = deserializeCatalogRows(dataset.rows);
    } else {
      const saved = await window.gestionUserDb.saveDataset("inventarios", catalogKey, serializeCatalogRows(catalogKey));
      catalogData[catalogKey].rows = deserializeCatalogRows(saved.rows);
    }
    if (activeCatalog === catalogKey) renderRows();
  } catch (error) {
    // Mantiene los valores en memoria si el usuario no tiene conexion temporal
  }
}

async function persistActiveCatalog() {
  const saved = await window.gestionUserDb.saveDataset("inventarios", activeCatalog, serializeCatalogRows(activeCatalog));
  catalogData[activeCatalog].rows = deserializeCatalogRows(saved.rows);
}

function renderRows() {
  const catalog = catalogData[activeCatalog];
  const term = searchInput.value.trim().toLowerCase();
  const rows = catalog.rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => `${row.name} ${row.description} ${row.status} ${row.serial || ""}`.toLowerCase().includes(term));

  countLabel.textContent = `${rows.length} ${catalog.countLabel}`;
  if (!rows.length) {
    rowsContainer.innerHTML = '<div class="employee-empty">No hay elementos en el catalogo que coincidan con la busqueda.</div>';
    return;
  }
  rowsContainer.innerHTML = rows
    .map((row) => {
      const validHex = normalizeHex(row.color);
      const swatch = validHex ? `<i class="color-swatch" style="--swatch:${escapeHtml(validHex)}"></i>` : "";
      return `
        <div class="catalog-row" data-index="${row.index}">
          <strong>${swatch}${escapeHtml(row.name)}</strong>
          <span>${escapeHtml(row.description)}</span>
          <span class="serial-cell"><code>${escapeHtml(row.serial || "Asignando...")}</code></span>
          <b class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</b>
          <span class="row-actions">
            <button type="button" data-action="edit" title="Editar" aria-label="Editar"><img src="./assets/icons/inventory-edit.svg" alt="" /></button>
            <button type="button" data-action="delete" title="Eliminar" aria-label="Eliminar"><img src="./assets/icons/inventory-delete.svg" alt="" /></button>
          </span>
        </div>
      `;
    })
    .join("");
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
  syncCatalog(activeCatalog);
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

rowsContainer.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  const row = event.target.closest(".catalog-row");
  if (!button || !row) return;

  const index = Number(row.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= catalogData[activeCatalog].rows.length) return;

  if (button.dataset.action === "delete") {
    button.disabled = true;
    catalogData[activeCatalog].rows.splice(index, 1);
    renderRows();
    try {
      await persistActiveCatalog();
      renderRows();
      showToast("Elemento eliminado del catalogo.");
    } catch (error) {
      showToast(error.message, true);
    }
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

catalogForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const description = descriptionInput.value.trim();
  const status = statusInput.value;
  const color = activeCatalog === "colores" ? normalizeHex(colorInput.value) : "";

  if (!name || !description || (activeCatalog === "colores" && !color)) {
    errorMessage.hidden = false;
    return;
  }

  const wasEditing = editIndex !== null;
  const previousSerial = wasEditing ? catalogData[activeCatalog].rows[editIndex]?.serial : "Asignando...";
  const nextRow = { name, description, status, serial: previousSerial || "Asignando..." };
  if (activeCatalog === "colores") {
    nextRow.color = color;
    nextRow.description = description.includes("#") ? description : `Codigo ${color} — ${description}`;
  }

  if (!wasEditing) {
    catalogData[activeCatalog].rows.unshift(nextRow);
  } else {
    catalogData[activeCatalog].rows[editIndex] = nextRow;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Guardando...";
  try {
    await persistActiveCatalog();
    hideForm();
    renderRows();
    showToast(wasEditing ? "Catalogo actualizado correctamente." : "Registro agregado al catalogo.");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Guardar";
  }
});

setCatalog(activeCatalog);
