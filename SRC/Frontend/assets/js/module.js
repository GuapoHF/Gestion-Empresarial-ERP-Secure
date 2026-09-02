const modules = window.TEXTILES_MODULES || {};
const reports = window.TEXTILES_REPORTS || [];
const guides = window.TEXTILES_GUIDES || [];
const params = new URLSearchParams(window.location.search);
const requestedModule = params.get("modulo") || "compras";
const redirects = { administrador: "./admin.html", actividad: "./bitacora.html", configuracion: "./configuracion.html" };
const moduleSessionUser = window.gestionUserDb.getCurrentUser() || {};

function localizeBusinessText(value) {
  let text = String(value ?? "");
  if (moduleSessionUser.countryCode === "MX") {
    text = text.replaceAll("RTN", "RFC").replaceAll("HNL", "MXN").replaceAll("ISV", "IVA").replaceAll("SAR", "SAT");
    text = text.replace(/(^|\s)L\s(?=\d)/g, "$1$ ");
  }
  return text;
}

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
let posTaxName = moduleSessionUser.countryCode === "MX" ? "IVA" : "ISV";
let posTaxRate = Number(moduleSessionUser.taxRate ?? 15);

function rowsStorageKey(moduleKey, viewKey) { return `textiles-gh-${moduleKey}-${viewKey}-rows`; }

function normalizeDatasetRows(moduleKey, viewKey, datasetRows) {
  if (moduleKey !== "ventas" || viewKey !== "cotizaciones") return datasetRows;
  return datasetRows.map((row) => {
    if (row.length !== 6) return row;
    const normalized = [...row];
    normalized[0] = normalized[0].replace(/^COT-/, "PRO-");
    normalized.splice(5, 0, "Exento");
    return normalized;
  });
}

function loadRows(moduleKey, viewKey, defaults = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(rowsStorageKey(moduleKey, viewKey)));
    return normalizeDatasetRows(moduleKey, viewKey, Array.isArray(saved) ? saved : defaults.map((row) => [...row]));
  } catch (error) {
    return defaults.map((row) => [...row]);
  }
}

async function saveRows() {
  localStorage.setItem(storageKey, JSON.stringify(rows));
  try {
    await window.gestionUserDb.saveDataset(currentKey, currentViewKey, rows);
  } catch (error) {
    showToast(`${error.message} Los cambios quedaron guardados solo en este navegador.`);
  }
}

async function syncDataset() {
  try {
    const dataset = await window.gestionUserDb.getDataset(currentKey, currentViewKey);
    if (dataset.initialized) {
      rows = normalizeDatasetRows(currentKey, currentViewKey, dataset.rows);
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } else {
      await window.gestionUserDb.saveDataset(currentKey, currentViewKey, rows);
    }
    if (typeof currentView.metrics === "string") {
      const relatedDatasets = metricDependencies(currentView.metrics).filter(([moduleKey, viewKey]) => moduleKey !== currentKey || viewKey !== currentViewKey);
      await Promise.all(relatedDatasets.map(async ([moduleKey, viewKey]) => {
        try {
          const related = await window.gestionUserDb.getDataset(moduleKey, viewKey);
          if (related.initialized) localStorage.setItem(rowsStorageKey(moduleKey, viewKey), JSON.stringify(related.rows));
        } catch (error) {
          // Each related section keeps using its local copy when it cannot be synchronized.
        }
      }));
    }
    renderMetrics();
    renderFilterOptions();
    renderTable();
  } catch (error) {
    showToast(`${error.message} Se muestran los datos disponibles en este navegador.`);
  }
}

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

function numericValue(value) {
  const normalized = String(value ?? "").replace(/[^\d,.-]/g, "").replaceAll(",", "");
  return Number.parseFloat(normalized) || 0;
}

function purchaseRows(viewKey) {
  if (currentKey === "compras" && viewKey === currentViewKey) return rows;
  const viewDefinition = modules.compras.views[viewKey];
  return loadRows("compras", viewKey, viewDefinition?.rows || []);
}

function moduleRows(moduleKey, viewKey) {
  if (currentKey === moduleKey && viewKey === currentViewKey) return rows;
  const viewDefinition = modules[moduleKey]?.views[viewKey];
  return loadRows(moduleKey, viewKey, viewDefinition?.rows || []);
}

function metricDependencies(metricType) {
  const dependencies = {
    "purchase-suppliers": [["compras", "proveedores"], ["compras", "comparativo"]],
    "purchase-orders": [["compras", "proveedores"], ["compras", "ordenes"], ["compras", "recepciones"]],
    "purchase-payables": [["compras", "pagos"]],
    "sales-clients": [["ventas", "clientes"], ["ventas", "cobranza"]],
    "sales-invoices": [["ventas", "clientes"], ["ventas", "pedidos"], ["ventas", "facturas"]],
    "sales-receivables": [["ventas", "cobranza"]],
    "inventory-products": [["inventarios", "productos"], ["inventarios", "almacenes"], ["costos", "analisis"]],
    "accounting-summary": [["contabilidad", "bancos"], ["contabilidad", "cierres"], ["ventas", "cobranza"], ["compras", "pagos"]],
    "cost-analysis": [["costos", "analisis"], ["costos", "margenes"], ["inventarios", "productos"]],
  };
  return dependencies[metricType] || [];
}

function currency(value, decimals = 0) {
  return `${moduleSessionUser.currencySymbol || "L"} ${Number(value || 0).toLocaleString(moduleSessionUser.locale || "es-HN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function totalAt(data, index) {
  return data.reduce((sum, row) => sum + numericValue(row[index]), 0);
}

function operationalMetrics(metricType) {
  if (metricType === "inventory-products") {
    const products = moduleRows("inventarios", "productos");
    const warehouses = moduleRows("inventarios", "almacenes").filter((row) => /activo/i.test(row[6]));
    const costs = new Map(moduleRows("costos", "analisis").map((row) => [row[0], numericValue(row[2])]));
    const active = products.filter((row) => /activo/i.test(row[6]));
    const lowStock = products.filter((row) => /bajo minimo/i.test(row[6]));
    const stock = totalAt(products.filter((row) => !/inactivo/i.test(row[6])), 5);
    const inventoryValue = products.reduce((sum, row) => sum + numericValue(row[5]) * (costs.get(row[0]) || 0), 0);
    const categories = new Set(active.map((row) => row[2]).filter(Boolean)).size;
    return [
      ["Productos activos", String(active.length), `${categories} categorias activas`],
      ["Existencia total", `${stock.toLocaleString(moduleSessionUser.locale || "es-HN")} unidades`, `En ${warehouses.length} almacenes activos`],
      ["Bajo minimo", String(lowStock.length), "Requieren compra"],
      ["Valor inventario", currency(inventoryValue), `${costs.size} productos con costo registrado`],
    ];
  }

  if (metricType === "accounting-summary") {
    const bankRows = moduleRows("contabilidad", "bancos");
    const receivables = moduleRows("ventas", "cobranza").filter((row) => !/pagado/i.test(row[6]));
    const payables = moduleRows("compras", "pagos").filter((row) => !/pagado/i.test(row[6]));
    const closingTasks = moduleRows("contabilidad", "cierres");
    const completed = closingTasks.filter((row) => /completado/i.test(row[5]));
    const reconciled = bankRows.filter((row) => /conciliado/i.test(row[6]));
    const balance = totalAt(bankRows, 5) - totalAt(bankRows, 4);
    return [
      ["Saldo en bancos", currency(balance), `${reconciled.length} de ${bankRows.length} movimientos conciliados`],
      ["Cuentas por cobrar", currency(totalAt(receivables, 4)), `${receivables.length} facturas abiertas`],
      ["Cuentas por pagar", currency(totalAt(payables, 4)), `${payables.length} documentos pendientes`],
      ["Cierre del periodo", `${closingTasks.length ? Math.round((completed.length / closingTasks.length) * 100) : 0}%`, `${completed.length} de ${closingTasks.length} tareas completadas`],
    ];
  }

  if (metricType === "cost-analysis") {
    const analyses = moduleRows("costos", "analisis");
    const products = moduleRows("inventarios", "productos");
    const minimumMargins = moduleRows("costos", "margenes").map((row) => numericValue(row[2])).filter((value) => value > 0);
    const minimumMargin = minimumMargins.length ? Math.max(...minimumMargins) : 30;
    const productStock = new Map(products.map((row) => [row[0], numericValue(row[5])]));
    const inventoryCost = analyses.reduce((sum, row) => sum + numericValue(row[2]) * (productStock.get(row[0]) || 0), 0);
    const margins = analyses.map((row) => numericValue(row[5]));
    const rotations = analyses.map((row) => numericValue(row[6])).filter((value) => value > 0);
    const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const lowMargin = margins.filter((margin) => margin < minimumMargin).length;
    return [
      ["Costo de inventario", currency(inventoryCost), `${analyses.length} productos costeados`],
      ["Margen promedio", `${average(margins).toFixed(1)}%`, `Calculado sobre ${margins.length} productos`],
      ["Telas bajo margen", String(lowMargin), `Margen minimo de referencia: ${minimumMargin}%`],
      ["Rotacion promedio", `${Math.round(average(rotations))} dias`, `${rotations.length} productos analizados`],
    ];
  }
  return [];
}

function salesMetrics(metricType) {
  const clients = moduleRows("ventas", "clientes");
  const orders = moduleRows("ventas", "pedidos");
  const invoices = moduleRows("ventas", "facturas");
  const receivables = moduleRows("ventas", "cobranza");
  const activeClients = clients.filter((row) => /activo/i.test(row[6]));
  const openInvoices = invoices.filter((row) => !/pagada|anulada/i.test(row[5]));
  const pendingOrders = orders.filter((row) => !/entregado|cancelado/i.test(row[5]));
  const openReceivables = receivables.filter((row) => !/pagado/i.test(row[6]));
  const dueSoon = openReceivables.filter((row) => /por vencer|parcial/i.test(row[6]));
  const overdue = openReceivables.filter((row) => /vencido/i.test(row[6]));
  const total = (data, index) => data.reduce((sum, row) => sum + numericValue(row[index]), 0);
  const currency = (value) => `${moduleSessionUser.currencySymbol || "L"} ${Math.round(value).toLocaleString(moduleSessionUser.locale || "es-HN")}`;
  const invoiceSales = total(invoices.filter((row) => !/anulada/i.test(row[5])), 4);
  const authorizedCredit = total(clients, 4);
  const usedCredit = total(clients, 5);
  const portfolio = total(openReceivables, 4);
  const healthyPortfolio = total(openReceivables.filter((row) => !/vencido/i.test(row[6])), 4);

  if (metricType === "sales-clients") return [
    ["Clientes activos", String(activeClients.length), `${clients.length} clientes registrados`],
    ["Credito autorizado", currency(authorizedCredit), `${authorizedCredit ? Math.round((usedCredit / authorizedCredit) * 100) : 0}% utilizado`],
    ["Cartera al dia", `${portfolio ? Math.round((healthyPortfolio / portfolio) * 100) : 100}%`, `${overdue.length} documentos vencidos`],
    ["Retencion", `${clients.length ? Math.round((activeClients.length / clients.length) * 100) : 0}%`, "Clientes activos del total registrado"],
  ];
  if (metricType === "sales-invoices") return [
    ["Ventas registradas", currency(invoiceSales), `${invoices.length} facturas emitidas`],
    ["Facturas abiertas", String(openInvoices.length), `${currency(total(openInvoices, 4))} por cobrar`],
    ["Pedidos por facturar", String(pendingOrders.length), `${currency(total(pendingOrders, 4))} en pedidos abiertos`],
    ["Ticket promedio", currency(invoices.length ? invoiceSales / invoices.length : 0), `${activeClients.length} clientes activos`],
  ];
  if (metricType === "sales-receivables") return [
    ["Cartera total", currency(portfolio), `${openReceivables.length} facturas abiertas`],
    ["Por vencer", currency(total(dueSoon, 4)), `${dueSoon.length} documentos vigentes o parciales`],
    ["Vencido", currency(total(overdue, 4)), `${new Set(overdue.map((row) => row[1])).size} clientes`],
    ["Saldo promedio", currency(openReceivables.length ? portfolio / openReceivables.length : 0), "Por factura abierta"],
  ];
  return [];
}

function purchaseMetrics(metricType) {
  const suppliers = purchaseRows("proveedores");
  const orders = purchaseRows("ordenes");
  const receipts = purchaseRows("recepciones");
  const comparisons = purchaseRows("comparativo");
  const payables = purchaseRows("pagos");
  const activeSuppliers = suppliers.filter((row) => String(row[6]).toLowerCase() === "activo");
  const openOrders = orders.filter((row) => !/recibida|cancelada/i.test(row[5]));
  const inTransit = orders.filter((row) => /transito/i.test(row[5]));
  const validReceipts = receipts.filter((row) => /validada/i.test(row[6]));
  const deliveryDays = comparisons.map((row) => numericValue(row[3])).filter((value) => value > 0);
  const complianceRates = comparisons.map((row) => numericValue(row[5]));
  const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  const currency = (value) => `${moduleSessionUser.currencySymbol || "L"} ${Math.round(value).toLocaleString(moduleSessionUser.locale || "es-HN")}`;

  if (metricType === "purchase-suppliers") return [
    ["Proveedores activos", String(activeSuppliers.length), `${suppliers.length} proveedores registrados`],
    ["Credito disponible", currency(suppliers.reduce((total, row) => total + numericValue(row[4]), 0)), `${suppliers.filter((row) => numericValue(row[4]) > 0).length} lineas autorizadas`],
    ["Entrega promedio", `${average(deliveryDays).toFixed(1)} dias`, `${deliveryDays.length} ofertas comparadas`],
    ["Cumplimiento", `${Math.round(average(complianceRates))}%`, `${complianceRates.length} evaluaciones de proveedor`],
  ];
  if (metricType === "purchase-orders") return [
    ["Ordenes abiertas", String(openOrders.length), `${openOrders.filter((row) => /pendiente/i.test(row[5])).length} requieren aprobacion`],
    ["En transito", currency(inTransit.reduce((total, row) => total + numericValue(row[4]), 0)), `${inTransit.length} ordenes en camino`],
    ["Proveedores activos", String(activeSuppliers.length), `${suppliers.length} proveedores registrados`],
    ["Recepciones conformes", `${receipts.length ? Math.round((validReceipts.length / receipts.length) * 100) : 0}%`, `${validReceipts.length} de ${receipts.length} recepciones validadas`],
  ];
  if (metricType === "purchase-payables") {
    const openPayables = payables.filter((row) => !/pagado/i.test(row[6]));
    const overdue = openPayables.filter((row) => /vencido/i.test(row[6]));
    const partial = openPayables.filter((row) => /parcial/i.test(row[6]));
    return [
      ["Saldo total", currency(openPayables.reduce((total, row) => total + numericValue(row[4]), 0)), `${openPayables.length} documentos abiertos`],
      ["Por vencer", currency(openPayables.filter((row) => /por vencer/i.test(row[6])).reduce((total, row) => total + numericValue(row[4]), 0)), "Segun documentos registrados"],
      ["Pagos parciales", currency(partial.reduce((total, row) => total + numericValue(row[4]), 0)), `${partial.length} documentos con abonos`],
      ["Vencido", currency(overdue.reduce((total, row) => total + numericValue(row[4]), 0)), `${overdue.length} documentos requieren atencion`],
    ];
  }
  return [];
}

function renderMetrics() {
  const dynamicMetrics = currentKey === "ventas" ? salesMetrics : currentKey === "compras" ? purchaseMetrics : operationalMetrics;
  const metrics = typeof currentView.metrics === "string" ? dynamicMetrics(currentView.metrics) : (currentView.metrics || []);
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
    const cells = row.map((cell, cellIndex) => `<span>${cellIndex === statusIndex ? `<b class="status ${statusClass(cell)}">${escapeHtml(localizeBusinessText(cell))}</b>` : escapeHtml(localizeBusinessText(cell))}</span>`).join("");
    return `<div class="module-table-row" data-row-index="${index}">${cells}${renderActions(index)}</div>`;
  }).join("");
  view.innerHTML = `<div class="module-table-wrap"><div class="module-table" style="--columns:${currentView.columns.length}">
    <div class="module-table-row module-table-head">${currentView.columns.map((column) => `<span>${escapeHtml(localizeBusinessText(column))}</span>`).join("")}</div>${body}</div>
    ${visibleRows.length ? "" : '<p class="module-empty-state">No hay registros que coincidan con la busqueda.</p>'}</div>`;
}

function renderFilterOptions() {
  const statusIndex = Number.isInteger(currentView.statusIndex) ? currentView.statusIndex : -1;
  filterControl.hidden = statusIndex < 0;
  if (statusIndex < 0) return;
  const statuses = [...new Set(rows.map((row) => row[statusIndex]).filter(Boolean))];
  filterInput.innerHTML = '<option value="">Todos</option>' + statuses.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");
}

function refreshDataView() {
  renderFilterOptions();
  renderTable();
  renderMetrics();
}

function handleStoredRowsChange(event) {
  if (!event.key?.startsWith("textiles-gh-") || event.newValue === null) return;

  if (event.key === storageKey) {
    try {
      const savedRows = JSON.parse(event.newValue);
      if (Array.isArray(savedRows)) rows = savedRows;
    } catch (error) {
      return;
    }
    refreshDataView();
    return;
  }

  // Dynamic indicators combine several sections, so a change made in another
  // tab must also refresh the cards shown in the current section.
  if (typeof currentView.metrics === "string" && metricDependencies(currentView.metrics).some(([moduleKey]) => event.key.startsWith(`textiles-gh-${moduleKey}-`))) renderMetrics();
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
      <div class="support-banner"><div><strong>Soporte interno de ${escapeHtml(moduleSessionUser.company || "Gestion Empresarial")}</strong><span>soporte@gestion-empresarial.local &middot; Ext. 104</span></div><a href="mailto:soporte@gestion-empresarial.local?subject=Solicitud%20de%20soporte">Crear solicitud &gt;</a></div>`;
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
  return new Intl.NumberFormat(moduleSessionUser.locale || "es-HN", { style: "currency", currency: moduleSessionUser.currencyCode || "HNL", minimumFractionDigits: 2 }).format(value);
}

function renderPosProducts(products) {
  return products.map((product) => `<article class="pos-product-card"><span>${escapeHtml(product.id)}</span><h3>${escapeHtml(product.name)}</h3><small>Disponible: ${escapeHtml(product.stock)}</small><div><strong>${money(product.price)} / ${escapeHtml(product.unit)}</strong><button type="button" data-pos="add" data-id="${product.id}" aria-label="Agregar ${escapeHtml(product.name)}">+</button></div></article>`).join("");
}

function renderPos() {
  toolbar.hidden = true;
  const subtotal = posCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = Number.isFinite(posTaxRate) ? Math.min(100, Math.max(0, posTaxRate)) : 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  view.innerHTML = `<div class="pos-layout"><section class="pos-products">
    <div class="pos-section-heading"><div><h2>Productos disponibles</h2><p>Selecciona una tela para agregarla a la venta.</p></div><label class="search-control pos-search"><img src="./assets/icons/inventory-search.svg" alt="" /><input id="pos-search" type="search" placeholder="Buscar tela o codigo..." /></label></div>
    <div class="pos-product-grid" id="pos-product-grid">${renderPosProducts(posProducts)}</div></section>
    <aside class="pos-cart"><div class="pos-cart-heading"><div><h2>Venta actual</h2><p>Folio POS-2026-0142</p></div><button type="button" data-pos="clear"${posCart.length ? "" : " disabled"}>Vaciar</button></div>
    <label class="pos-field"><span>Cliente</span><select><option>Publico general</option><option>Confecciones Atlas</option><option>Uniformes Rivera</option><option>Moda Centro</option></select></label>
    <div class="pos-cart-items">${posCart.length ? posCart.map((item) => `<div class="pos-cart-row"><div><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} / ${escapeHtml(item.unit)}</small></div><div class="pos-quantity"><button type="button" data-pos="decrease" data-id="${item.id}" aria-label="Reducir cantidad">-</button><span>${item.quantity}</span><button type="button" data-pos="increase" data-id="${item.id}" aria-label="Aumentar cantidad">+</button></div><strong>${money(item.price * item.quantity)}</strong></div>`).join("") : '<div class="pos-empty"><strong>Aun no hay productos</strong><span>Agrega telas desde el catalogo para iniciar la venta.</span></div>'}</div>
    <div class="pos-summary"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
    <div class="pos-tax-editor"><label><span>Impuesto</span><input id="pos-tax-name" type="text" value="${escapeHtml(posTaxName)}" maxlength="30" placeholder="Nombre" aria-label="Nombre del impuesto" /></label><label><span>Porcentaje</span><span class="pos-tax-rate"><input id="pos-tax-rate" type="number" value="${taxRate}" min="0" max="100" step="0.01" aria-label="Porcentaje del impuesto" /><b>%</b></span></label></div>
    <div><span id="pos-tax-label">${escapeHtml(posTaxName || "Impuesto")} ${taxRate}%</span><strong id="pos-tax-amount">${money(tax)}</strong></div><div class="pos-total"><span>Total</span><strong id="pos-total-amount">${money(total)}</strong></div></div>
    <label class="pos-field"><span>Forma de pago</span><select><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Credito autorizado</option></select></label>
    <button class="primary-action pos-complete" type="button" data-pos="complete"${posCart.length ? "" : " disabled"}>Cobrar y finalizar venta</button></aside></div>`;
  const posSearch = document.querySelector("#pos-search");
  posSearch.addEventListener("input", () => {
    const term = posSearch.value.toLowerCase().trim();
    document.querySelector("#pos-product-grid").innerHTML = renderPosProducts(posProducts.filter((product) => `${product.id} ${product.name}`.toLowerCase().includes(term)));
  });
  const taxNameInput = document.querySelector("#pos-tax-name");
  const taxRateInput = document.querySelector("#pos-tax-rate");
  const updateTax = () => {
    posTaxName = taxNameInput.value;
    const enteredRate = Number(taxRateInput.value);
    posTaxRate = Number.isFinite(enteredRate) ? Math.min(100, Math.max(0, enteredRate)) : 0;
    const updatedTax = subtotal * (posTaxRate / 100);
    document.querySelector("#pos-tax-label").textContent = `${posTaxName.trim() || "Impuesto"} ${posTaxRate}%`;
    document.querySelector("#pos-tax-amount").textContent = money(updatedTax);
    document.querySelector("#pos-total-amount").textContent = money(subtotal + updatedTax);
  };
  taxNameInput.addEventListener("input", updateTax);
  taxRateInput.addEventListener("input", updateTax);
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
    const generatedValue = editIndex === null ? automaticFieldValue(index) : "";
    const value = normalizeInputValue(row[index] || generatedValue, type);
    if (type === "select") {
      return `<label class="field"><span>${escapeHtml(localizeBusinessText(label))}</span><select name="field-${index}" required>${option.map((item) => `<option value="${escapeHtml(item)}"${item === value ? " selected" : ""}>${escapeHtml(localizeBusinessText(item))}</option>`).join("")}</select></label>`;
    }
    const isAutomatic = currentView.autoNumber?.index === index || currentView.autoCorrelative?.index === index;
    const isClient = currentKey === "ventas" && /^cliente$/i.test(label);
    const list = isClient ? ' list="sales-client-list" autocomplete="off"' : "";
    return `<label class="field"><span>${escapeHtml(localizeBusinessText(label))}</span><input name="field-${index}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(localizeBusinessText(option))}"${list}${isAutomatic ? ' readonly aria-readonly="true"' : ""} required /></label>`;
  }).join("");
  if (currentKey === "ventas" && currentView.fields.some(([label]) => /^cliente$/i.test(label))) {
    const clientNames = moduleRows("ventas", "clientes").map((client) => client[1]).filter(Boolean);
    formFields.insertAdjacentHTML("beforeend", `<datalist id="sales-client-list">${clientNames.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist>`);
  }
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
  if (type === "date") return new Intl.DateTimeFormat(moduleSessionUser.locale || "es-HN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)).replace(".", "");
  if (type === "number") return `${moduleSessionUser.currencySymbol || "L"} ${Number(value).toLocaleString(moduleSessionUser.locale || "es-HN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return value;
}

async function appendTargetRow(moduleKey, viewKey, row) {
  const targetView = modules[moduleKey].views[viewKey];
  let targetRows = loadRows(moduleKey, viewKey, targetView.rows || []);
  try {
    const dataset = await window.gestionUserDb.getDataset(moduleKey, viewKey);
    if (dataset.initialized) targetRows = dataset.rows;
  } catch (error) {
    // The local copy remains available if the server is temporarily unavailable.
  }
  targetRows.unshift(row);
  localStorage.setItem(rowsStorageKey(moduleKey, viewKey), JSON.stringify(targetRows));
  await window.gestionUserDb.saveDataset(moduleKey, viewKey, targetRows);
}

function renderAccountingHub() {
  toolbar.hidden = true;
  metricsContainer.hidden = true;
  const documents = [
    ["income-statement", "Estado de resultados", "Ingresos, costos, gastos y utilidad del periodo."],
    ["balance-sheet", "Balance general", "Activo, pasivo y capital contable comparados."],
    ["trial-balance", "Balanza de comprobacion", "Saldos iniciales, debe, haber y saldo final por cuenta."],
    ["payroll-catalog", "Percepciones y deducciones", "Catalogo de conceptos y acumulados de nomina."],
    ["sales-profit", "Ventas y utilidad", "Cantidad, costo, precio, utilidad y margen por producto."],
    ["purchase-invoice", "Factura de compra", "Documento de proveedor, recepcion, pesos e importes."],
  ];
  view.innerHTML = `<div class="accounting-document-grid">${documents.map(([type, title, description]) => `
    <a class="accounting-document-card" href="./reportes-contables.html?tipo=${type}"><span>Documento contable</span><h2>${title}</h2><p>${description}</p><strong>Generar documento &gt;</strong></a>`).join("")}</div>`;
}

function sequentialNumber(definition, sourceRows = rows) {
  const year = new Date().getFullYear();
  const prefixes = [definition.prefix, ...(definition.aliases || [])];
  const highest = sourceRows.reduce((maximum, row) => {
    const value = String(row[definition.index ?? 0] || "");
    const matchesPrefix = prefixes.some((prefix) => value.startsWith(`${prefix}-`));
    if (!matchesPrefix) return maximum;
    const match = value.match(/(\d+)$/);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  const sequence = String(highest + 1).padStart(definition.digits, "0");
  return definition.year ? `${definition.prefix}-${year}-${sequence}` : `${definition.prefix}-${sequence}`;
}

function automaticFieldValue(index) {
  if (currentView.autoNumber?.index === index) return sequentialNumber(currentView.autoNumber);
  if (currentView.autoCorrelative?.index === index) {
    const source = sequentialNumber(currentView.autoNumber);
    const sequence = source.match(/(\d+)$/)?.[1] || "1";
    return `${currentView.autoCorrelative.prefix}-${sequence.padStart(currentView.autoCorrelative.digits, "0")}`;
  }
  return "";
}

async function nextTargetDocument(moduleKey, viewKey) {
  const targetView = modules[moduleKey].views[viewKey];
  let targetRows = loadRows(moduleKey, viewKey, targetView.rows || []);
  try {
    const dataset = await window.gestionUserDb.getDataset(moduleKey, viewKey);
    if (dataset.initialized) targetRows = normalizeDatasetRows(moduleKey, viewKey, dataset.rows);
  } catch (error) {
    // Generate from the synchronized local copy while the server is unavailable.
  }
  const documentNumber = sequentialNumber(targetView.autoNumber, targetRows);
  return { targetView, documentNumber };
}

async function runWorkflow(index) {
  const row = rows[index];
  const type = currentView.workflow.type;
  if (type === "requisition-to-order") {
    await appendTargetRow("compras", "ordenes", [`OC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`, "Proveedor por asignar", row[2], row[3], "L 0", "Borrador"]);
    navigate("compras", "ordenes");
  } else if (type === "order-to-receipt") {
    await appendTargetRow("compras", "recepciones", [`REC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`, row[0], row[1], "Lote por capturar", "0 m", "0 m", "Pendiente"]);
    navigate("compras", "recepciones");
  } else if (type === "receipt-to-stock") {
    sessionStorage.setItem("textiles-gh-flash", `${row[0]} ingresada al inventario.`);
    window.location.href = "./inventario.html";
  } else if (type === "quote-to-order") {
    const { documentNumber } = await nextTargetDocument("ventas", "pedidos");
    await appendTargetRow("ventas", "pedidos", [documentNumber, row[1], row[2], row[3], row[4], "Pendiente"]);
    navigate("ventas", "pedidos");
  } else if (type === "order-to-invoice") {
    const today = new Intl.DateTimeFormat(moduleSessionUser.locale || "es-HN", { day: "numeric", month: "short", year: "numeric" }).format(new Date()).replace(".", "");
    const { targetView, documentNumber } = await nextTargetDocument("ventas", "facturas");
    const sequence = documentNumber.match(/(\d+)$/)?.[1] || "1";
    const correlative = `${targetView.autoCorrelative.prefix}-${sequence.padStart(targetView.autoCorrelative.digits, "0")}`;
    await appendTargetRow("ventas", "facturas", [documentNumber, row[1], correlative, today, row[4], "Borrador"]);
    navigate("ventas", "facturas");
  } else if (type === "invoice-to-payment") {
    await appendTargetRow("ventas", "cobranza", [row[0], row[1], row[3], row[4], row[4], "0-15 dias", "Por vencer"]);
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
  if (currentView.type === "accounting-hub") {
    window.location.href = "./reportes-contables.html";
    return;
  }
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
  document.querySelector("#current-date").textContent = new Intl.DateTimeFormat(moduleSessionUser.locale || "es-HN", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  document.querySelectorAll(".side-nav a").forEach((link) => link.classList.toggle("active", link.dataset.module === currentKey));
  renderTabs();
  renderMetrics();
  actionButton.hidden = !currentView.action;
  actionButton.textContent = currentView.action || "";
  actionButton.addEventListener("click", handlePrimaryAction);

  if (currentView.type === "reports") return renderReports();
  if (currentView.type === "help") return renderGuides();
  if (currentView.type === "pos") return renderPos();
  if (currentView.type === "accounting-hub") return renderAccountingHub();
  toolbar.hidden = false;
  searchInput.placeholder = currentView.search || "Buscar...";
  renderFilterOptions();
  renderTable();
  searchInput.addEventListener("input", renderTable);
  filterInput.addEventListener("change", renderTable);
  syncDataset();
}

view.addEventListener("click", async (event) => {
  const posButton = event.target.closest("[data-pos]");
  if (posButton) return handlePosAction(posButton);
  const reportButton = event.target.closest("[data-report]");
  if (reportButton) return exportReport(Number(reportButton.dataset.report));
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const index = Number(button.closest(".row-actions")?.dataset.index);
  if (button.dataset.action === "edit") openForm(index);
  if (button.dataset.action === "workflow") {
    button.disabled = true;
    try { await runWorkflow(index); }
    catch (error) { button.disabled = false; showToast(error.message); }
  }
  if (button.dataset.action === "details") showToast("Detalle consultado. No hay cambios pendientes.");
  if (button.dataset.action === "delete") {
    rows.splice(index, 1);
    refreshDataView();
    await saveRows();
    showToast("Registro eliminado correctamente.");
  }
});

form.addEventListener("submit", async (event) => {
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
  closeForm();
  // Reflect the edit in both the table and its summary cards immediately;
  // remote persistence can finish afterwards without freezing the interface.
  refreshDataView();
  await saveRows();
  showToast(wasEditing ? "Registro actualizado correctamente." : "Registro guardado correctamente.");
});

document.querySelector("#module-dialog-close").addEventListener("click", closeForm);
document.querySelector("#module-dialog-cancel").addEventListener("click", closeForm);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeForm(); });
window.addEventListener("storage", handleStoredRowsChange);
initializePage();
