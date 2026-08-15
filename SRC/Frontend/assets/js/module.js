const modules = window.TEXTILES_MODULES || {};
const reports = window.TEXTILES_REPORTS || [];
const guides = window.TEXTILES_GUIDES || [];
const params = new URLSearchParams(window.location.search);
const requestedModule = params.get("modulo") || "compras";
const redirects = { administrador: "./admin.html", actividad: "./bitacora.html", configuracion: "./configuracion.html" };

if (redirects[requestedModule]) window.location.replace(redirects[requestedModule]);

const currentKey = modules[requestedModule] ? requestedModule : "compras";
const currentModule = modules[currentKey];
const requestedView = params.get("vista");
const currentViewKey = currentModule.views[requestedView] ? requestedView : currentModule.defaultView;
const currentView = currentModule.views[currentViewKey];
const storageKey = rowsStorageKey(currentKey, currentViewKey);
const metricsContainer = document.querySelector("#module-metrics");
const tabs = document.querySelector("#module-tabs");
const toolbar = document.querySelector("#module-toolbar");
const searchInput = document.querySelector("#module-search");
const filterControl = document.querySelector(".module-filter");
const filterInput = document.querySelector("#module-filter");
const view = document.querySelector("#module-view");
const actionButton = document.querySelector("#module-primary-action");
const dialog = document.querySelector("#module-dialog");
const form = document.querySelector("#module-form");
const formFields = document.querySelector("#module-form-fields");
const formError = document.querySelector("#module-form-error");
const toast = document.querySelector("#module-toast");
let rows = loadRows(currentKey, currentViewKey, currentView.rows || []);
let editIndex = null;
let posCart = [];

function rowsStorageKey(moduleKey, viewKey) { return `textiles-gh-${moduleKey}-${viewKey}-rows`; }

function loadRows(moduleKey, viewKey, defaults = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(rowsStorageKey(moduleKey, viewKey)));
    return Array.isArray(saved) ? saved : defaults.map((row) => [...row]);
  } catch (error) {
    return defaults.map((row) => [...row]);
  }
}

function saveRows() { localStorage.setItem(storageKey, JSON.stringify(rows)); }

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => { toast.hidden = true; }, 2800);
}

function navigate(moduleKey, viewKey) {
  window.location.href = `./modulo.html?modulo=${encodeURIComponent(moduleKey)}&vista=${encodeURIComponent(viewKey)}`;
}

function renderTabs() {
  const entries = Object.entries(currentModule.views);
  tabs.hidden = entries.length < 2;
  tabs.innerHTML = entries.map(([key, section]) =>
    `<a href="./modulo.html?modulo=${escapeHtml(currentKey)}&vista=${escapeHtml(key)}"${key === currentViewKey ? ' class="active" aria-current="page"' : ""}>${escapeHtml(section.label)}</a>`
  ).join("");
}

function renderMetrics() {
  const metrics = currentView.metrics || [];
  metricsContainer.innerHTML = metrics.map(([label, value, detail]) =>
    `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`
  ).join("");
  metricsContainer.hidden = metrics.length === 0;
}

function statusClass(value) {
  const normalized = String(value).toLowerCase();
  if (/activo|activa|aprobada|recibida|pagada|registrado|conciliado|validada|liberado|aplicada|acreditada|completado|recomendada|vigente/.test(normalized)) return "complete";
  if (/transito|preparacion|enviada|parcial|revision|proceso|alternativa|temporal|listo/.test(normalized)) return "processing";
  return "pending";
}

function renderActions(index) {
  const actions = [];
  if (currentView.workflow) actions.push(`<button class="module-workflow-action" type="button" data-action="workflow" title="${escapeHtml(currentView.workflow.label)}">${escapeHtml(currentView.workflow.label)}</button>`);
  if (currentView.fields) {
    actions.push('<button type="button" data-action="edit" title="Editar" aria-label="Editar"><img src="./assets/icons/inventory-edit.svg" alt="" /></button>');
    actions.push('<button type="button" data-action="delete" title="Eliminar" aria-label="Eliminar"><img src="./assets/icons/inventory-delete.svg" alt="" /></button>');
  } else if (!currentView.workflow) {
    actions.push('<button class="module-workflow-action" type="button" data-action="details" title="Consultar registro">Ver detalle</button>');
  }
  return `<span class="row-actions" data-index="${index}">${actions.join("")}</span>`;
}

function renderTable() {
  const term = searchInput.value.trim().toLowerCase();
  const status = filterInput.value;
  const statusIndex = Number.isInteger(currentView.statusIndex) ? currentView.statusIndex : -1;
  const visibleRows = rows.map((row, index) => ({ row, index })).filter(({ row }) =>
    row.join(" ").toLowerCase().includes(term) && (!status || row[statusIndex] === status)
  );
  const body = visibleRows.map(({ row, index }) => {
    const cells = row.map((cell, cellIndex) => `<span>${cellIndex === statusIndex ? `<b class="status ${statusClass(cell)}">${escapeHtml(cell)}</b>` : escapeHtml(cell)}</span>`).join("");
    return `<div class="module-table-row" data-row-index="${index}">${cells}${renderActions(index)}</div>`;
  }).join("");
  view.innerHTML = `<div class="module-table-wrap"><div class="module-table" style="--columns:${currentView.columns.length}">
    <div class="module-table-row module-table-head">${currentView.columns.map((column) => `<span>${escapeHtml(column)}</span>`).join("")}</div>${body}</div>
    ${visibleRows.length ? "" : '<p class="module-empty-state">No hay registros que coincidan con la busqueda.</p>'}</div>`;
}

function renderFilterOptions() {
  const statusIndex = Number.isInteger(currentView.statusIndex) ? currentView.statusIndex : -1;
  filterControl.hidden = statusIndex < 0;
  if (statusIndex < 0) return;
  const statuses = [...new Set(rows.map((row) => row[statusIndex]).filter(Boolean))];
  filterInput.innerHTML = '<option value="">Todos</option>' + statuses.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");
}

function renderReports() {
  toolbar.innerHTML = `<label class="module-filter"><span>Periodo</span><select><option>Agosto 2026</option><option>Julio 2026</option><option>Segundo trimestre 2026</option></select></label>
    <label class="module-filter"><span>Ubicacion</span><select><option>Todas las ubicaciones</option><option>Bodega Central</option><option>Tienda Principal</option></select></label>`;
  view.innerHTML = `<div class="report-grid">${reports.map(([title, description], index) => `<article class="report-card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><div><small>CSV listo para Excel</small><button type="button" data-report="${index}">Generar reporte</button></div></article>`).join("")}</div>`;
}

function guideHref(moduleKey, viewKey) {
  return moduleKey === "inventario.html" ? "./inventario.html" : `./modulo.html?modulo=${encodeURIComponent(moduleKey)}&vista=${encodeURIComponent(viewKey)}`;
}

function renderGuides() {
  metricsContainer.hidden = true;
  toolbar.innerHTML = `<label class="search-control help-search" for="help-search"><img src="./assets/icons/inventory-search.svg" alt="" /><input id="help-search" type="search" placeholder="Buscar una guia, modulo o proceso..." /></label>`;
  const input = toolbar.querySelector("input");
  const draw = () => {
    const term = input.value.trim().toLowerCase();
    const matches = guides.filter((guide) => guide.join(" ").toLowerCase().includes(term));
    view.innerHTML = `<h2 class="module-section-title">Guias por proceso</h2><div class="help-grid">${matches.map(([title, description, route, moduleKey, viewKey]) => `<a class="help-card" href="${guideHref(moduleKey, viewKey)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span><small>${escapeHtml(route)} &gt;</small></a>`).join("")}</div>
      <div class="support-banner"><div><strong>Soporte interno de Textiles GH</strong><span>soporte@textilesgh.com &middot; Ext. 104</span></div><a href="mailto:soporte@textilesgh.com?subject=Solicitud%20de%20soporte%20Textiles%20GH">Crear solicitud &gt;</a></div>`;
  };
  input.addEventListener("input", draw);
  draw();
}

const posProducts = [
  { id: "TELA-00142", name: "Manta cruda 1.50 m", stock: "730 m", price: 37, unit: "m" },
  { id: "TELA-00098", name: "Lino premium azul", stock: "240 m", price: 55, unit: "m" },
  { id: "TELA-00215", name: "Popelina floral", stock: "180 m", price: 31, unit: "m" },
  { id: "TELA-00176", name: "Mezclilla indigo 12 oz", stock: "24 rollos", price: 99, unit: "m" },
  { id: "TELA-00208", name: "Gabardina gris Oxford", stock: "315 m", price: 72, unit: "m" },
  { id: "TELA-00231", name: "Satin carmesi", stock: "175 m", price: 86, unit: "m" },
];

function money(value) {
  return new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL", minimumFractionDigits: 2 }).format(value);
}

function renderPosProducts(products) {
  return products.map((product) => `<article class="pos-product-card"><span>${escapeHtml(product.id)}</span><h3>${escapeHtml(product.name)}</h3><small>Disponible: ${escapeHtml(product.stock)}</small><div><strong>${money(product.price)} / ${escapeHtml(product.unit)}</strong><button type="button" data-pos="add" data-id="${product.id}" aria-label="Agregar ${escapeHtml(product.name)}">+</button></div></article>`).join("");
}

function renderPos() {
  toolbar.hidden = true;
  const subtotal = posCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;
  view.innerHTML = `<div class="pos-layout"><section class="pos-products">
    <div class="pos-section-heading"><div><h2>Productos disponibles</h2><p>Selecciona una tela para agregarla a la venta.</p></div><label class="search-control pos-search"><img src="./assets/icons/inventory-search.svg" alt="" /><input id="pos-search" type="search" placeholder="Buscar tela o codigo..." /></label></div>
    <div class="pos-product-grid" id="pos-product-grid">${renderPosProducts(posProducts)}</div></section>
    <aside class="pos-cart"><div class="pos-cart-heading"><div><h2>Venta actual</h2><p>Folio POS-2026-0142</p></div><button type="button" data-pos="clear"${posCart.length ? "" : " disabled"}>Vaciar</button></div>
    <label class="pos-field"><span>Cliente</span><select><option>Publico general</option><option>Confecciones Atlas</option><option>Uniformes Rivera</option><option>Moda Centro</option></select></label>
    <div class="pos-cart-items">${posCart.length ? posCart.map((item) => `<div class="pos-cart-row"><div><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} / ${escapeHtml(item.unit)}</small></div><div class="pos-quantity"><button type="button" data-pos="decrease" data-id="${item.id}" aria-label="Reducir cantidad">-</button><span>${item.quantity}</span><button type="button" data-pos="increase" data-id="${item.id}" aria-label="Aumentar cantidad">+</button></div><strong>${money(item.price * item.quantity)}</strong></div>`).join("") : '<div class="pos-empty"><strong>Aun no hay productos</strong><span>Agrega telas desde el catalogo para iniciar la venta.</span></div>'}</div>
    <div class="pos-summary"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div><span>ISV 15%</span><strong>${money(tax)}</strong></div><div class="pos-total"><span>Total</span><strong>${money(total)}</strong></div></div>
    <label class="pos-field"><span>Forma de pago</span><select><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Credito autorizado</option></select></label>
    <button class="primary-action pos-complete" type="button" data-pos="complete"${posCart.length ? "" : " disabled"}>Cobrar y finalizar venta</button></aside></div>`;
  const posSearch = document.querySelector("#pos-search");
  posSearch.addEventListener("input", () => {
    const term = posSearch.value.toLowerCase().trim();
    document.querySelector("#pos-product-grid").innerHTML = renderPosProducts(posProducts.filter((product) => `${product.id} ${product.name}`.toLowerCase().includes(term)));
  });
}

function handlePosAction(button) {
  const action = button.dataset.pos;
  const product = posProducts.find((item) => item.id === button.dataset.id);
  const cartItem = posCart.find((item) => item.id === button.dataset.id);
  if (action === "add") cartItem ? cartItem.quantity += 1 : posCart.push({ ...product, quantity: 1 });
  if (action === "increase") cartItem.quantity += 1;
  if (action === "decrease") {
    cartItem.quantity -= 1;
    if (cartItem.quantity <= 0) posCart = posCart.filter((item) => item.id !== cartItem.id);
  }
  if (action === "clear") posCart = [];
  if (action === "complete") {
    posCart = [];
    showToast("Venta POS-2026-0142 cobrada e inventario actualizado.");
  }
  renderPos();
}

function normalizeInputValue(value, type) {
  if (type === "number") return String(value).replace(/[^\d.]/g, "");
  if (type !== "date" || /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const months = { ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06", jul: "07", ago: "08", sept: "09", oct: "10", nov: "11", dic: "12" };
  const match = String(value).toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  return match && months[match[2]] ? `${match[3]}-${months[match[2]]}-${match[1].padStart(2, "0")}` : "";
}

function buildForm(row = []) {
  formFields.innerHTML = currentView.fields.map(([label, type, option], index) => {
    const value = normalizeInputValue(row[index] || "", type);
    if (type === "select") {
      return `<label class="field"><span>${escapeHtml(label)}</span><select name="field-${index}" required>${option.map((item) => `<option${item === value ? " selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label>`;
    }
    return `<label class="field"><span>${escapeHtml(label)}</span><input name="field-${index}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(option)}" required /></label>`;
  }).join("");
}

function openForm(index = null) {
  if (!currentView.fields) return;
  editIndex = index;
  document.querySelector("#module-form-title").textContent = index === null ? currentView.action.replace("+ ", "") : "Editar registro";
  document.querySelector("#module-form-help").textContent = `Completa la informacion de ${currentView.label.toLowerCase()}.`;
  formError.hidden = true;
  buildForm(index === null ? [] : rows[index]);
  dialog.showModal();
}

function closeForm() {
  dialog.close();
  form.reset();
  editIndex = null;
}

function formatFieldValue(value, type) {
  if (type === "date") return new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)).replace(".", "");
  if (type === "number") return `L ${Number(value).toLocaleString("es-HN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return value;
}

function appendTargetRow(moduleKey, viewKey, row) {
  const targetView = modules[moduleKey].views[viewKey];
  const targetRows = loadRows(moduleKey, viewKey, targetView.rows || []);
  targetRows.unshift(row);
  localStorage.setItem(rowsStorageKey(moduleKey, viewKey), JSON.stringify(targetRows));
}

function nextNumber(prefix) {
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
}

function runWorkflow(index) {
  const row = rows[index];
  const type = currentView.workflow.type;
  if (type === "requisition-to-order") {
    appendTargetRow("compras", "ordenes", [nextNumber("OC"), "Proveedor por asignar", row[2], row[3], "L 0", "Borrador"]);
    navigate("compras", "ordenes");
  } else if (type === "order-to-receipt") {
    appendTargetRow("compras", "recepciones", [nextNumber("REC"), row[0], row[1], "Lote por capturar", "0 m", "0 m", "Pendiente"]);
    navigate("compras", "recepciones");
  } else if (type === "receipt-to-stock") {
    sessionStorage.setItem("textiles-gh-flash", `${row[0]} ingresada al inventario.`);
    window.location.href = "./inventario.html";
  } else if (type === "quote-to-order") {
    appendTargetRow("ventas", "pedidos", [nextNumber("PED"), row[1], row[2], row[3], row[4], "Pendiente"]);
    navigate("ventas", "pedidos");
  } else if (type === "order-to-invoice") {
    const today = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", year: "numeric" }).format(new Date()).replace(".", "");
    appendTargetRow("ventas", "facturas", [nextNumber("FAC"), row[1], "Correlativo por asignar", today, row[4], "Borrador"]);
    navigate("ventas", "facturas");
  } else if (type === "invoice-to-payment") {
    appendTargetRow("ventas", "cobranza", [row[0], row[1], row[3], row[4], row[4], "0-15 dias", "Por vencer"]);
    navigate("ventas", "cobranza");
  } else if (type === "client-to-collections") {
    navigate("ventas", "cobranza");
  }
}

function exportReport(index = 0) {
  const title = reports[index]?.[0] || currentView.label;
  const link = document.createElement("a");
  link.href = "./assets/reporte-textiles-gh.csv";
  link.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("Reporte generado en formato CSV.");
}

function handlePrimaryAction() {
  if (currentView.fields) return openForm();
  if (currentView.specialAction === "recalculate") {
    const original = actionButton.textContent;
    actionButton.disabled = true;
    actionButton.textContent = "Calculando...";
    window.setTimeout(() => {
      actionButton.disabled = false;
      actionButton.textContent = original;
      showToast("Costos y margenes actualizados correctamente.");
    }, 900);
    return;
  }
  if (/exportar/i.test(currentView.action || "")) return exportReport();
  showToast(`${currentView.action} completado correctamente.`);
}

function initializePage() {
  document.title = `Gestion Empresarial | ${currentModule.title} - ${currentView.label}`;
  document.querySelector("#module-title").textContent = currentModule.title;
  document.querySelector("#crumb-title").textContent = `${currentModule.title} / ${currentView.label}`;
  document.querySelector("#module-description").textContent = currentView.description;
  document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  document.querySelectorAll(".side-nav a").forEach((link) => link.classList.toggle("active", link.dataset.module === currentKey));
  renderTabs();
  renderMetrics();
  actionButton.hidden = !currentView.action;
  actionButton.textContent = currentView.action || "";
  actionButton.addEventListener("click", handlePrimaryAction);

  if (currentView.type === "reports") return renderReports();
  if (currentView.type === "help") return renderGuides();
  if (currentView.type === "pos") return renderPos();
  toolbar.hidden = false;
  searchInput.placeholder = currentView.search || "Buscar...";
  renderFilterOptions();
  renderTable();
  searchInput.addEventListener("input", renderTable);
  filterInput.addEventListener("change", renderTable);
}

view.addEventListener("click", (event) => {
  const posButton = event.target.closest("[data-pos]");
  if (posButton) return handlePosAction(posButton);
  const reportButton = event.target.closest("[data-report]");
  if (reportButton) return exportReport(Number(reportButton.dataset.report));
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const index = Number(button.closest(".row-actions")?.dataset.index);
  if (button.dataset.action === "edit") openForm(index);
  if (button.dataset.action === "workflow") runWorkflow(index);
  if (button.dataset.action === "details") showToast("Detalle consultado. No hay cambios pendientes.");
  if (button.dataset.action === "delete") {
    rows.splice(index, 1);
    saveRows();
    renderFilterOptions();
    renderTable();
    showToast("Registro eliminado correctamente.");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    formError.hidden = false;
    form.reportValidity();
    return;
  }
  const wasEditing = editIndex !== null;
  const data = new FormData(form);
  const values = currentView.fields.map(([, type], index) => formatFieldValue(data.get(`field-${index}`), type));
  if (wasEditing) rows[editIndex] = values;
  else rows.unshift(values);
  saveRows();
  closeForm();
  renderFilterOptions();
  renderTable();
  showToast(wasEditing ? "Registro actualizado correctamente." : "Registro guardado correctamente.");
});

document.querySelector("#module-dialog-close").addEventListener("click", closeForm);
document.querySelector("#module-dialog-cancel").addEventListener("click", closeForm);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeForm(); });
initializePage();
