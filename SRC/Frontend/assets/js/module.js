const modules = window.TEXTILES_MODULES || {};
const reports = window.TEXTILES_REPORTS || [];
const guides = window.TEXTILES_GUIDES || [];
const params = new URLSearchParams(window.location.search);
const requestedModule = params.get("modulo") || "compras";
const redirects = { administrador: "./admin.html", actividad: "./bitacora.html", configuracion: "./configuracion.html" };
const moduleSessionUser = window.gestionUserDb.getCurrentUser() || {};

function activeUser() {
  return window.gestionUserDb.getCurrentUser() || moduleSessionUser || {};
}

function activeCompanyId() {
  return Number(activeUser().companyId || 1);
}

function localizeBusinessText(value) {
  let text = String(value ?? "");
  if (activeUser().countryCode === "MX") {
    text = text.replaceAll("RTN", "RFC").replaceAll("HNL", "MXN").replaceAll("ISV", "IVA").replaceAll("SAR", "SAT");
    text = text.replace(/(^|\s)L\s(?=\d)/g, "$1$ ");
    text = text.replace(/lempiras/gi, "pesos mexicanos");
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

function rowsWithSerialPlaceholder(datasetRows, viewDefinition = currentView) {
  if (!viewDefinition.columns) return datasetRows;
  const expectedDataColumns = viewDefinition.columns.length;
  return datasetRows.map((row) => (row.length >= expectedDataColumns ? row : [...row, "Asignando..."]));
}

let rows = rowsWithSerialPlaceholder(loadRows(currentKey, currentViewKey, currentView.rows || []));
let editIndex = null;
let posCart = [];
let posTaxName = activeUser().countryCode === "MX" ? "IVA" : "ISV";
let posTaxRate = Number(activeUser().taxRate ?? (activeUser().countryCode === "MX" ? 16 : 15));

function rowsStorageKey(moduleKey, viewKey) {
  return `textiles-gh-c${activeCompanyId()}-${moduleKey}-${viewKey}-rows`;
}

function normalizeDatasetRows(moduleKey, viewKey, datasetRows) {
  if (moduleKey === "ventas" && viewKey === "cotizaciones") {
    return datasetRows.map((row) => {
      if (row.length !== 6) return row;
      const normalized = [...row];
      normalized[0] = normalized[0].replace(/^COT-/, "PRO-");
      normalized.splice(5, 0, "Exento");
      return normalized;
    });
  }
  if (moduleKey === "ventas" && viewKey === "pedidos") {
    return datasetRows.map((row) => {
      if (row.length !== 7) return row;
      const detail = String(row[2] || "");
      const quantity = detail.match(/[+-]?\d+(?:[.,]\d+)?/)?.[0] || "1";
      const product = detail.replace(/^[+-]?\d+(?:[.,]\d+)?\s*(?:m|metros?|rollos?|piezas?)?\s*/i, "") || detail;
      return [row[0], row[1], product, quantity, "Detalle", row[3], row[4], row[5], row[6]];
    });
  }
  if (moduleKey === "inventarios" && viewKey === "productos") {
    return datasetRows.map((row) => {
      if (row.length !== 8) return row;
      const sym = activeUser().currencySymbol || "L";
      return [row[0], row[1], activeUser().company || "Vicmar", row[2], "Rollo", row[4], row[5], `${sym} 0`, `${sym} 0`, `${sym} 0`, "Sin configurar", row[6], row[7]];
    });
  }
  return datasetRows;
}

function loadRows(moduleKey, viewKey, defaults = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(rowsStorageKey(moduleKey, viewKey)));
    if (Array.isArray(saved)) {
      return normalizeDatasetRows(moduleKey, viewKey, saved);
    }
  } catch (error) {
    // Fallback a filas base de la vista
  }
  return normalizeDatasetRows(
    moduleKey,
    viewKey,
    defaults.map((row) => row.map((cell) => localizeBusinessText(cell)))
  );
}

async function saveRows() {
  localStorage.setItem(storageKey, JSON.stringify(rows));
  try {
    const saved = await window.gestionUserDb.saveDataset(currentKey, currentViewKey, rows, activeCompanyId());
    rows = rowsWithSerialPlaceholder(saved.rows);
    localStorage.setItem(storageKey, JSON.stringify(rows));
    refreshDataView();
  } catch (error) {
    showToast(`${error.message} Los cambios quedaron guardados localmente.`, true);
  }
}

async function syncDataset() {
  try {
    const dataset = await window.gestionUserDb.getDataset(currentKey, currentViewKey, activeCompanyId());
    if (dataset.initialized) {
      rows = rowsWithSerialPlaceholder(normalizeDatasetRows(currentKey, currentViewKey, dataset.rows));
      if (rows.some((row) => row.at(-1) === "Asignando...")) {
        const saved = await window.gestionUserDb.saveDataset(currentKey, currentViewKey, rows, activeCompanyId());
        rows = rowsWithSerialPlaceholder(saved.rows);
      }
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } else {
      const initialRows = rowsWithSerialPlaceholder(
        (currentView.rows || []).map((row) => row.map((cell) => localizeBusinessText(cell)))
      );
      const saved = await window.gestionUserDb.saveDataset(currentKey, currentViewKey, initialRows, activeCompanyId());
      rows = rowsWithSerialPlaceholder(saved.rows);
      localStorage.setItem(storageKey, JSON.stringify(rows));
    }
    if (typeof currentView.metrics === "string") {
      const relatedDatasets = metricDependencies(currentView.metrics).filter(
        ([moduleKey, viewKey]) => moduleKey !== currentKey || viewKey !== currentViewKey
      );
      await Promise.all(
        relatedDatasets.map(async ([moduleKey, viewKey]) => {
          try {
            const related = await window.gestionUserDb.getDataset(moduleKey, viewKey, activeCompanyId());
            if (related.initialized) {
              localStorage.setItem(rowsStorageKey(moduleKey, viewKey), JSON.stringify(related.rows));
            }
          } catch (error) {
            // Conserva copia local en caso de error de red puntual.
          }
        })
      );
    }
    renderMetrics();
    renderFilterOptions();
    renderTable();
  } catch (error) {
    showToast(`${error.message} Se muestran los datos disponibles en este navegador.`, true);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, isError = false) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("error", Boolean(isError));
  toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function navigate(moduleKey, viewKey) {
  window.location.href = `./modulo.html?modulo=${encodeURIComponent(moduleKey)}&vista=${encodeURIComponent(viewKey)}`;
}

function renderTabs() {
  const entries = Object.entries(currentModule.views);
  tabs.hidden = entries.length < 2;
  tabs.innerHTML = entries
    .map(
      ([key, section]) =>
        `<a href="./modulo.html?modulo=${escapeHtml(currentKey)}&vista=${escapeHtml(key)}"${
          key === currentViewKey ? ' class="active" aria-current="page"' : ""
        }>${escapeHtml(section.label)}</a>`
    )
    .join("");
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
    "inventory-products": [["inventarios", "productos"], ["inventarios", "almacenes"]],
    "accounting-summary": [["contabilidad", "bancos"], ["contabilidad", "cierres"], ["ventas", "cobranza"], ["compras", "pagos"]],
    "cost-analysis": [["costos", "analisis"], ["costos", "margenes"], ["inventarios", "productos"]],
  };
  return dependencies[metricType] || [];
}

function currency(value, decimals = 0) {
  const u = activeUser();
  return `${u.currencySymbol || "L"} ${Number(value || 0).toLocaleString(u.locale || "es-HN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function totalAt(data, index) {
  return data.reduce((sum, row) => sum + numericValue(row[index]), 0);
}

function operationalMetrics(metricType) {
  const u = activeUser();
  if (metricType === "inventory-products") {
    const products = moduleRows("inventarios", "productos");
    const warehouses = moduleRows("inventarios", "almacenes").filter((row) => /activo/i.test(row[6]));
    const active = products.filter((row) => /activo/i.test(row[11]));
    const lowStock = products.filter((row) => /bajo minimo|existencia negativa/i.test(row[11]));
    const stock = totalAt(products.filter((row) => !/inactivo/i.test(row[11])), 6);
    const negativeStock = products.filter((row) => numericValue(row[6]) < 0);
    const categories = new Set(active.map((row) => row[3]).filter(Boolean)).size;
    return [
      ["Productos activos", String(active.length), `${categories} categorias textiles`],
      ["Existencia total", `${stock.toLocaleString(u.locale || "es-HN")} m / rollos`, `En ${warehouses.length} almacenes activos`],
      ["Bajo minimo", String(lowStock.length), "Requieren abastecimiento"],
      ["Existencia negativa", String(negativeStock.length), negativeStock.length ? "Requiere regularizacion" : "Inventario regularizado"],
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
    const productStock = new Map(products.map((row) => [row[0], numericValue(row[6])]));
    const inventoryCost = analyses.reduce((sum, row) => sum + numericValue(row[2]) * Math.max(0, productStock.get(row[0]) || 0), 0);
    const margins = analyses.map((row) => numericValue(row[5]));
    const rotations = analyses.map((row) => numericValue(row[6])).filter((value) => value > 0);
    const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
    const lowMargin = margins.filter((margin) => margin < minimumMargin).length;
    return [
      ["Costo de inventario", currency(inventoryCost), `${analyses.length} telas costeadas`],
      ["Margen promedio", `${average(margins).toFixed(1)}%`, `Calculado sobre ${margins.length} telas`],
      ["Telas bajo margen", String(lowMargin), `Margen minimo de referencia: ${minimumMargin}%`],
      ["Rotacion promedio", `${Math.round(average(rotations))} dias`, `${rotations.length} telas analizadas`],
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
  const pendingOrders = orders.filter((row) => !/entregado|cancelado/i.test(row[7]));
  const openReceivables = receivables.filter((row) => !/pagado/i.test(row[6]));
  const dueSoon = openReceivables.filter((row) => /por vencer|parcial/i.test(row[6]));
  const overdue = openReceivables.filter((row) => /vencido/i.test(row[6]));
  const total = (data, index) => data.reduce((sum, row) => sum + numericValue(row[index]), 0);
  const fmtCurrency = (value) => currency(Math.round(value), 0);
  const invoiceSales = total(invoices.filter((row) => !/anulada/i.test(row[5])), 4);
  const authorizedCredit = total(clients, 4);
  const usedCredit = total(clients, 5);
  const portfolio = total(openReceivables, 4);
  const healthyPortfolio = total(openReceivables.filter((row) => !/vencido/i.test(row[6])), 4);

  if (metricType === "sales-clients") {
    return [
      ["Clientes activos", String(activeClients.length), `${clients.length} clientes registrados`],
      ["Credito autorizado", fmtCurrency(authorizedCredit), `${authorizedCredit ? Math.round((usedCredit / authorizedCredit) * 100) : 0}% utilizado`],
      ["Cartera al dia", `${portfolio ? Math.round((healthyPortfolio / portfolio) * 100) : 100}%`, `${overdue.length} documentos vencidos`],
      ["Retencion", `${clients.length ? Math.round((activeClients.length / clients.length) * 100) : 0}%`, "Clientes activos del total registrado"],
    ];
  }
  if (metricType === "sales-invoices") {
    return [
      ["Ventas registradas", fmtCurrency(invoiceSales), `${invoices.length} facturas emitidas`],
      ["Facturas abiertas", String(openInvoices.length), `${fmtCurrency(total(openInvoices, 4))} por cobrar`],
      ["Pedidos por facturar", String(pendingOrders.length), `${fmtCurrency(total(pendingOrders, 6))} en pedidos abiertos`],
      ["Ticket promedio", fmtCurrency(invoices.length ? invoiceSales / invoices.length : 0), `${activeClients.length} clientes activos`],
    ];
  }
  if (metricType === "sales-receivables") {
    return [
      ["Cartera total", fmtCurrency(portfolio), `${openReceivables.length} facturas abiertas`],
      ["Por vencer", fmtCurrency(total(dueSoon, 4)), `${dueSoon.length} documentos vigentes o parciales`],
      ["Vencido", fmtCurrency(total(overdue, 4)), `${new Set(overdue.map((row) => row[1])).size} clientes`],
      ["Saldo promedio", fmtCurrency(openReceivables.length ? portfolio / openReceivables.length : 0), "Por factura abierta"],
    ];
  }
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
  const average = (values) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0);
  const fmtCurrency = (value) => currency(Math.round(value), 0);

  if (metricType === "purchase-suppliers") {
    return [
      ["Proveedores activos", String(activeSuppliers.length), `${suppliers.length} proveedores registrados`],
      ["Credito disponible", fmtCurrency(suppliers.reduce((total, row) => total + numericValue(row[4]), 0)), `${suppliers.filter((row) => numericValue(row[4]) > 0).length} lineas autorizadas`],
      ["Entrega promedio", `${average(deliveryDays).toFixed(1)} dias`, `${deliveryDays.length} ofertas comparadas`],
      ["Cumplimiento", `${Math.round(average(complianceRates))}%`, `${complianceRates.length} evaluaciones de proveedor`],
    ];
  }
  if (metricType === "purchase-orders") {
    return [
      ["Ordenes abiertas", String(openOrders.length), `${openOrders.filter((row) => /pendiente/i.test(row[5])).length} requieren aprobacion`],
      ["En transito", fmtCurrency(inTransit.reduce((total, row) => total + numericValue(row[4]), 0)), `${inTransit.length} ordenes en camino`],
      ["Proveedores activos", String(activeSuppliers.length), `${suppliers.length} proveedores registrados`],
      ["Recepciones conformes", `${receipts.length ? Math.round((validReceipts.length / receipts.length) * 100) : 0}%`, `${validReceipts.length} de ${receipts.length} recepciones validadas`],
    ];
  }
  if (metricType === "purchase-payables") {
    const openPayables = payables.filter((row) => !/pagado/i.test(row[6]));
    const overdue = openPayables.filter((row) => /vencido/i.test(row[6]));
    const partial = openPayables.filter((row) => /parcial/i.test(row[6]));
    return [
      ["Saldo total", fmtCurrency(openPayables.reduce((total, row) => total + numericValue(row[4]), 0)), `${openPayables.length} documentos abiertos`],
      ["Por vencer", fmtCurrency(openPayables.filter((row) => /por vencer/i.test(row[6])).reduce((total, row) => total + numericValue(row[4]), 0)), "Segun documentos registrados"],
      ["Pagos parciales", fmtCurrency(partial.reduce((total, row) => total + numericValue(row[4]), 0)), `${partial.length} documentos con abonos`],
      ["Vencido", fmtCurrency(overdue.reduce((total, row) => total + numericValue(row[4]), 0)), `${overdue.length} documentos requieren atencion`],
    ];
  }
  return [];
}

function renderMetrics() {
  const dynamicMetrics = currentKey === "ventas" ? salesMetrics : currentKey === "compras" ? purchaseMetrics : operationalMetrics;
  let metrics = typeof currentView.metrics === "string" ? dynamicMetrics(currentView.metrics) : currentView.metrics || [];
  if (Array.isArray(currentView.metrics)) {
    metrics = currentView.metrics.map(([label, value, detail]) => [
      localizeBusinessText(label),
      localizeBusinessText(value),
      localizeBusinessText(detail),
    ]);
  }
  metricsContainer.innerHTML = metrics
    .map(
      ([label, value, detail]) =>
        `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`
    )
    .join("");
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
  if (currentView.workflow) {
    actions.push(
      `<button class="module-workflow-action" type="button" data-action="workflow" title="${escapeHtml(currentView.workflow.label)}">${escapeHtml(currentView.workflow.label)}</button>`
    );
  }
  if (currentView.fields) {
    actions.push('<button type="button" data-action="edit" title="Editar" aria-label="Editar"><img src="./assets/icons/inventory-edit.svg" alt="" /></button>');
    actions.push('<button type="button" data-action="delete" title="Eliminar" aria-label="Eliminar"><img src="./assets/icons/inventory-delete.svg" alt="" /></button>');
  }
  return `<span class="row-actions" data-index="${index}">${actions.join("")}</span>`;
}

function filteredRows() {
  const term = searchInput.value.trim().toLowerCase();
  const status = filterInput.value;
  const statusIndex = Number.isInteger(currentView.statusIndex) ? currentView.statusIndex : -1;
  const category = document.querySelector("#inventory-category-filter")?.value || "";
  const stock = document.querySelector("#inventory-stock-filter")?.value || "";
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const quantity = currentKey === "inventarios" && currentViewKey === "productos" ? numericValue(row[6]) : 0;
      const matchesStock = !stock || (stock === "negative" ? quantity < 0 : stock === "positive" ? quantity > 0 : quantity === 0);
      return (
        row.join(" ").toLowerCase().includes(term) &&
        (!status || row[statusIndex] === status) &&
        (!category || row[3] === category) &&
        matchesStock
      );
    });
}

function renderTable() {
  const statusIndex = Number.isInteger(currentView.statusIndex) ? currentView.statusIndex : -1;
  const visibleRows = filteredRows();
  const displayColumns = [...currentView.columns];
  const hasActionsColumn = displayColumns.at(-1) === "Acciones";
  if (hasActionsColumn) {
    displayColumns.splice(-1, 0, "No. de serie");
  } else {
    displayColumns.push("No. de serie");
  }

  const body = visibleRows
    .map(({ row, index }) => {
      const serialIndex = row.length - 1;
      const cells = row
        .map((cell, cellIndex) => {
          const renderedText = escapeHtml(localizeBusinessText(cell));
          if (cellIndex === statusIndex) {
            return `<span><b class="status ${statusClass(cell)}">${renderedText}</b></span>`;
          }
          if (cellIndex === serialIndex && /^SER-/.test(String(cell))) {
            return `<span class="serial-cell"><code>${renderedText}</code></span>`;
          }
          return `<span>${renderedText}</span>`;
        })
        .join("");
      return `<div class="module-table-row" data-row-index="${index}">${cells}${renderActions(index)}</div>`;
    })
    .join("");

  view.innerHTML = `<div class="module-table-wrap"><div class="module-table" style="--columns:${displayColumns.length}">
    <div class="module-table-row module-table-head">${displayColumns
      .map((column) => `<span>${escapeHtml(localizeBusinessText(column))}</span>`)
      .join("")}</div>${body}</div>
    ${visibleRows.length ? "" : '<p class="module-empty-state">No hay registros que coincidan con los filtros seleccionados.</p>'}</div>`;
}

function renderFilterOptions() {
  const statusIndex = Number.isInteger(currentView.statusIndex) ? currentView.statusIndex : -1;
  filterControl.hidden = statusIndex < 0;
  if (statusIndex >= 0) {
    const currentSelection = filterInput.value;
    const statuses = [...new Set(rows.map((row) => row[statusIndex]).filter(Boolean))];
    filterInput.innerHTML =
      '<option value="">Todos</option>' +
      statuses
        .map((status) => `<option value="${escapeHtml(status)}"${status === currentSelection ? " selected" : ""}>${escapeHtml(status)}</option>`)
        .join("");
  }
  if (currentKey === "inventarios" && currentViewKey === "productos") {
    const categories = [...new Set(rows.map((row) => row[3]).filter(Boolean))];
    let categorySelect = document.querySelector("#inventory-category-filter");
    if (!categorySelect) {
      filterControl.insertAdjacentHTML(
        "afterend",
        `<label class="module-filter"><span>Categoria</span><select id="inventory-category-filter"><option value="">Todas</option></select></label><label class="module-filter"><span>Existencia</span><select id="inventory-stock-filter"><option value="">Todas</option><option value="positive">Positiva</option><option value="zero">En cero</option><option value="negative">Negativa</option></select></label><a class="secondary-action" href="./registrar-ingreso.html">+ Costear lote</a><button class="secondary-action inventory-export" id="inventory-export" type="button">Exportar a Excel</button>`
      );
      categorySelect = document.querySelector("#inventory-category-filter");
      categorySelect.addEventListener("change", renderTable);
      document.querySelector("#inventory-stock-filter").addEventListener("change", renderTable);
      document.querySelector("#inventory-export").addEventListener("click", exportInventory);
    }
    const previousCat = categorySelect.value;
    categorySelect.innerHTML =
      '<option value="">Todas</option>' +
      categories
        .map((category) => `<option value="${escapeHtml(category)}"${category === previousCat ? " selected" : ""}>${escapeHtml(category)}</option>`)
        .join("");
  }
}

function refreshDataView() {
  renderFilterOptions();
  renderTable();
  renderMetrics();
}

function handleStoredRowsChange(event) {
  if (!event.key?.startsWith(`textiles-gh-c${activeCompanyId()}-`) || event.newValue === null) return;

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

  if (
    typeof currentView.metrics === "string" &&
    metricDependencies(currentView.metrics).some(([moduleKey]) => event.key.startsWith(`textiles-gh-c${activeCompanyId()}-${moduleKey}-`))
  ) {
    renderMetrics();
  }
}

function renderReports() {
  toolbar.hidden = true;
  view.innerHTML = `<div class="report-grid">${reports
    .map(
      ([title, description], index) =>
        `<article class="report-card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><div><small>CSV consolidado (${escapeHtml(
          activeUser().company || "Empresa activa"
        )})</small><button type="button" data-report="${index}">Descargar CSV</button></div></article>`
    )
    .join("")}</div>`;
}

function guideHref(moduleKey, viewKey) {
  return moduleKey === "inventario.html"
    ? "./modulo.html?modulo=inventarios&vista=productos"
    : `./modulo.html?modulo=${encodeURIComponent(moduleKey)}&vista=${encodeURIComponent(viewKey)}`;
}

function renderGuides() {
  metricsContainer.hidden = true;
  toolbar.innerHTML = `<label class="search-control help-search" for="help-search"><img src="./assets/icons/inventory-search.svg" alt="" /><input id="help-search" type="search" placeholder="Buscar una guia, modulo o proceso textil..." /></label>`;
  const input = toolbar.querySelector("input");
  const draw = () => {
    const term = input.value.trim().toLowerCase();
    const matches = guides.filter((guide) => guide.join(" ").toLowerCase().includes(term));
    view.innerHTML = `<h2 class="module-section-title">Guias operativas por proceso</h2><div class="help-grid">${
      matches.length
        ? matches
            .map(
              ([title, description, route, moduleKey, viewKey]) =>
                `<a class="help-card" href="${guideHref(moduleKey, viewKey)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(
                  description
                )}</span><small>${escapeHtml(route)} &gt;</small></a>`
            )
            .join("")
        : '<p class="module-empty-state">No se encontraron guias con ese criterio.</p>'
    }</div>`;
  };
  input.addEventListener("input", draw);
  draw();
}

const defaultPosProducts = [
  { id: "TELA-00142", name: "Manta cruda 1.50 m", stock: "500 m", price: 37, unit: "m" },
  { id: "TELA-00098", name: "Lino premium azul", stock: "240 m", price: 55, unit: "m" },
  { id: "TELA-00215", name: "Popelina floral", stock: "180 m", price: 31, unit: "m" },
  { id: "TELA-00176", name: "Mezclilla indigo 12 oz", stock: "420 m", price: 99, unit: "m" },
  { id: "TELA-00208", name: "Gabardina gris Oxford", stock: "315 m", price: 72, unit: "m" },
  { id: "TELA-00231", name: "Satin carmesi", stock: "175 m", price: 86, unit: "m" },
];

function getPosProducts() {
  const inventoryRows = moduleRows("inventarios", "productos");
  if (!inventoryRows.length) return defaultPosProducts;
  const mapped = inventoryRows
    .filter((row) => !/inactivo/i.test(String(row[11] || "")))
    .map((row) => ({
      id: String(row[0] || "TELA-00000"),
      name: String(row[1] || "Tela comercial"),
      stock: `${row[6] || "0"} ${String(row[5] || "m").toLowerCase()}`,
      price: Math.max(1, numericValue(row[7]) || 35),
      unit: String(row[5] || "Metro").toLowerCase().startsWith("rollo") ? "rollo" : "m",
    }));
  return mapped.length ? mapped : defaultPosProducts;
}

function money(value) {
  const u = activeUser();
  return new Intl.NumberFormat(u.locale || "es-HN", {
    style: "currency",
    currency: u.currencyCode || "HNL",
    minimumFractionDigits: 2,
  }).format(value);
}

function renderPosProducts(products) {
  if (!products.length) {
    return '<p class="module-empty-state">No hay telas que coincidan con la busqueda.</p>';
  }
  return products
    .map(
      (product) =>
        `<article class="pos-product-card"><span>${escapeHtml(product.id)}</span><h3>${escapeHtml(product.name)}</h3><small>Disponible: ${escapeHtml(
          product.stock
        )}</small><div><strong>${money(product.price)} / ${escapeHtml(product.unit)}</strong><button type="button" data-pos="add" data-id="${escapeHtml(
          product.id
        )}" aria-label="Agregar ${escapeHtml(product.name)}">+</button></div></article>`
    )
    .join("");
}

function renderPos() {
  toolbar.hidden = true;
  const availableProducts = getPosProducts();
  const clientRows = moduleRows("ventas", "clientes");
  const clientNames = ["Publico general", ...new Set(clientRows.map((row) => row[1]).filter(Boolean))];
  const subtotal = posCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = Number.isFinite(posTaxRate) ? Math.min(100, Math.max(0, posTaxRate)) : 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  view.innerHTML = `<div class="pos-layout"><section class="pos-products">
    <div class="pos-section-heading"><div><h2>Catalogo de telas en mostrador</h2><p>Selecciona rollos o metros para agregar a la factura de mostrador.</p></div><label class="search-control pos-search"><img src="./assets/icons/inventory-search.svg" alt="" /><input id="pos-search" type="search" placeholder="Buscar tela o codigo..." /></label></div>
    <div class="pos-product-grid" id="pos-product-grid">${renderPosProducts(availableProducts)}</div></section>
    <aside class="pos-cart"><div class="pos-cart-heading"><div><h2>Venta de mostrador</h2><p>${escapeHtml(
      activeUser().company || "Sucursal Principal"
    )}</p></div><button type="button" data-pos="clear"${posCart.length ? "" : " disabled"}>Vaciar</button></div>
    <label class="pos-field"><span>Cliente</span><select id="pos-client-select">${clientNames
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("")}</select></label>
    <div class="pos-cart-items">${
      posCart.length
        ? posCart
            .map(
              (item) =>
                `<div class="pos-cart-row"><div><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} / ${escapeHtml(
                  item.unit
                )}</small></div><div class="pos-quantity"><button type="button" data-pos="decrease" data-id="${escapeHtml(
                  item.id
                )}" aria-label="Reducir cantidad">-</button><span>${item.quantity}</span><button type="button" data-pos="increase" data-id="${escapeHtml(
                  item.id
                )}" aria-label="Aumentar cantidad">+</button></div><strong>${money(item.price * item.quantity)}</strong></div>`
            )
            .join("")
        : '<div class="pos-empty"><strong>Sin telas en la orden</strong><span>Selecciona telas del catalogo izquierdo para iniciar el corte o venta.</span></div>'
    }</div>
    <div class="pos-summary"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
    <div class="pos-tax-editor"><label><span>Impuesto</span><input id="pos-tax-name" type="text" value="${escapeHtml(
      posTaxName
    )}" maxlength="30" placeholder="Impuesto" aria-label="Nombre del impuesto" /></label><label><span>Porcentaje</span><span class="pos-tax-rate"><input id="pos-tax-rate" type="number" value="${taxRate}" min="0" max="100" step="0.01" aria-label="Porcentaje del impuesto" /><b>%</b></span></label></div>
    <div><span id="pos-tax-label">${escapeHtml(posTaxName || "Impuesto")} ${taxRate}%</span><strong id="pos-tax-amount">${money(
      tax
    )}</strong></div><div class="pos-total"><span>Total</span><strong id="pos-total-amount">${money(total)}</strong></div></div>
    <label class="pos-field"><span>Forma de pago</span><select id="pos-payment-method"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Credito autorizado</option></select></label>
    <button class="primary-action pos-complete" type="button" data-pos="complete"${
      posCart.length ? "" : " disabled"
    }>Cobrar y emitir factura</button></aside></div>`;

  const posSearch = document.querySelector("#pos-search");
  posSearch.addEventListener("input", () => {
    const term = posSearch.value.toLowerCase().trim();
    document.querySelector("#pos-product-grid").innerHTML = renderPosProducts(
      availableProducts.filter((product) => `${product.id} ${product.name}`.toLowerCase().includes(term))
    );
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

async function handlePosAction(button) {
  const action = button.dataset.pos;
  const availableProducts = getPosProducts();
  const product = availableProducts.find((item) => item.id === button.dataset.id);
  const cartItem = posCart.find((item) => item.id === button.dataset.id);
  if (action === "add" && product) {
    cartItem ? (cartItem.quantity += 1) : posCart.push({ ...product, quantity: 1 });
  }
  if (action === "increase" && cartItem) cartItem.quantity += 1;
  if (action === "decrease" && cartItem) {
    cartItem.quantity -= 1;
    if (cartItem.quantity <= 0) posCart = posCart.filter((item) => item.id !== cartItem.id);
  }
  if (action === "clear") posCart = [];
  if (action === "complete" && posCart.length) {
    const client = document.querySelector("#pos-client-select")?.value || "Publico general";
    const subtotal = posCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal * (1 + (Number.isFinite(posTaxRate) ? posTaxRate : 0) / 100);
    button.disabled = true;
    button.textContent = "Emitiendo factura...";
    try {
      const today = new Intl.DateTimeFormat(activeUser().locale || "es-HN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
        .format(new Date())
        .replace(".", "");
      const { targetView, documentNumber } = await nextTargetDocument("ventas", "facturas");
      const sequence = documentNumber.match(/(\d+)$/)?.[1] || "1";
      const correlative = `${targetView.autoCorrelative.prefix}-${sequence.padStart(targetView.autoCorrelative.digits, "0")}`;
      await appendTargetRow("ventas", "facturas", [documentNumber, client, correlative, today, currency(total, 2), "Pagada"]);
      posCart = [];
      showToast(`Factura ${documentNumber} emitida y registrada en Ventas.`);
    } catch (error) {
      showToast(error.message || "No se pudo registrar la venta.", true);
    }
  }
  renderPos();
}

function normalizeInputValue(value, type) {
  if (type === "number") return String(value ?? "").replace(/[^\d.]/g, "");
  if (type === "quantity") return String(value ?? "").replace(/[^\d.-]/g, "");
  if (type !== "date" || /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const months = {
    ene: "01",
    feb: "02",
    mar: "03",
    abr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    ago: "08",
    sept: "09",
    sep: "09",
    oct: "10",
    nov: "11",
    dic: "12",
  };
  const match = String(value).toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  return match && months[match[2]] ? `${match[3]}-${months[match[2]]}-${match[1].padStart(2, "0")}` : "";
}

function buildForm(row = []) {
  formFields.innerHTML = currentView.fields
    .map(([label, type, option], index) => {
      const generatedValue = editIndex === null ? automaticFieldValue(index) : "";
      const rawCellValue = row[index] !== undefined ? localizeBusinessText(row[index]) : generatedValue;
      const value = normalizeInputValue(rawCellValue, type);
      if (type === "select") {
        const localizedOptions = option.map((item) => localizeBusinessText(item));
        return `<label class="field"><span>${escapeHtml(localizeBusinessText(label))}</span><select name="field-${index}" required>${localizedOptions
          .map((item) => `<option value="${escapeHtml(item)}"${item === value ? " selected" : ""}>${escapeHtml(item)}</option>`)
          .join("")}</select></label>`;
      }
      const isAutomatic = currentView.autoNumber?.index === index || currentView.autoCorrelative?.index === index;
      const inputType = type === "quantity" ? "number" : type;
      const isClient = currentKey === "ventas" && /^cliente$/i.test(label);
      const list = isClient ? ' list="sales-client-list" autocomplete="off"' : "";
      return `<label class="field"><span>${escapeHtml(localizeBusinessText(label))}</span><input name="field-${index}" type="${escapeHtml(
        inputType
      )}" value="${escapeHtml(value)}"${type === "quantity" ? ' step="any"' : ""}${type === "number" ? ' step="0.01" min="0"' : ""} placeholder="${escapeHtml(
        localizeBusinessText(option)
      )}"${list}${isAutomatic ? ' readonly aria-readonly="true"' : ""} required /></label>`;
    })
    .join("");
  if (currentKey === "ventas" && currentView.fields.some(([label]) => /^cliente$/i.test(label))) {
    const clientNames = moduleRows("ventas", "clientes")
      .map((client) => client[1])
      .filter(Boolean);
    formFields.insertAdjacentHTML(
      "beforeend",
      `<datalist id="sales-client-list">${clientNames.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist>`
    );
  }
}

function openForm(index = null) {
  if (!currentView.fields) return;
  editIndex = index;
  document.querySelector("#module-form-title").textContent = index === null ? currentView.action.replace("+ ", "") : "Editar registro";
  document.querySelector("#module-form-help").textContent = `Completa la informacion de ${currentView.label.toLowerCase()} para ${
    activeUser().company || "la empresa activa"
  }.`;
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
  const u = activeUser();
  if (type === "quantity") return String(value).trim();
  if (type === "date") {
    return new Intl.DateTimeFormat(u.locale || "es-HN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${value}T12:00:00Z`))
      .replace(".", "");
  }
  if (type === "number") {
    return `${u.currencySymbol || "L"} ${Number(value).toLocaleString(u.locale || "es-HN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }
  return String(value).trim();
}

async function appendTargetRow(moduleKey, viewKey, row) {
  const targetView = modules[moduleKey].views[viewKey];
  let targetRows = loadRows(moduleKey, viewKey, targetView.rows || []);
  try {
    const dataset = await window.gestionUserDb.getDataset(moduleKey, viewKey, activeCompanyId());
    if (dataset.initialized) targetRows = dataset.rows;
  } catch (error) {
    // Se conserva la copia sincronizada en caso de fallo de red temporal.
  }
  targetRows.unshift([...row, "Asignando..."]);
  localStorage.setItem(rowsStorageKey(moduleKey, viewKey), JSON.stringify(targetRows));
  const saved = await window.gestionUserDb.saveDataset(moduleKey, viewKey, targetRows, activeCompanyId());
  localStorage.setItem(rowsStorageKey(moduleKey, viewKey), JSON.stringify(saved.rows));
}

function renderAccountingHub() {
  toolbar.hidden = true;
  metricsContainer.hidden = true;
  const documents = [
    ["income-statement", "Estado de resultados", "Ingresos por venta de tela, costo de ventas, gastos operativos y utilidad neta."],
    ["balance-sheet", "Balance general", "Activos circulantes (inventario de rollos, bancos), pasivos y capital contable."],
    ["trial-balance", "Balanza de comprobacion", "Saldos iniciales, cargos, abonos y saldos finales por cuenta contable."],
    ["payroll-catalog", "Percepciones y deducciones", "Catalogo fiscal de conceptos y acumulados de nomina segun pais de la empresa."],
    ["sales-profit", "Ventas y utilidad por tela", "Metros/rollos vendidos, costo total, precio de venta, utilidad y margen comercial."],
    ["purchase-invoice", "Factura de importacion / compra", "Desglose de factura de proveedor textil, orden de trabajo, pesos e impuestos."],
  ];
  view.innerHTML = `<div class="accounting-document-grid">${documents
    .map(
      ([type, title, description]) => `
    <a class="accounting-document-card" href="./reportes-contables.html?tipo=${type}"><span>Documento contable</span><h2>${escapeHtml(
        title
      )}</h2><p>${escapeHtml(description)}</p><strong>Abrir documento &gt;</strong></a>`
    )
    .join("")}</div>`;
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
    const dataset = await window.gestionUserDb.getDataset(moduleKey, viewKey, activeCompanyId());
    if (dataset.initialized) targetRows = normalizeDatasetRows(moduleKey, viewKey, dataset.rows);
  } catch (error) {
    // Utiliza la copia local si el servidor no responde.
  }
  const documentNumber = sequentialNumber(targetView.autoNumber, targetRows);
  return { targetView, documentNumber };
}

async function runWorkflow(index) {
  const row = rows[index];
  const type = currentView.workflow.type;
  const sym = activeUser().currencySymbol || "L";
  if (type === "requisition-to-order") {
    await appendTargetRow("compras", "ordenes", [
      `OC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      "Proveedor por asignar",
      row[2],
      row[3],
      `${sym} 0`,
      "Borrador",
    ]);
    navigate("compras", "ordenes");
  } else if (type === "order-to-receipt") {
    await appendTargetRow("compras", "recepciones", [
      `REC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      row[0],
      row[1],
      "LOT-PENDIENTE",
      "0 m",
      "0 m",
      "Pendiente",
    ]);
    navigate("compras", "recepciones");
  } else if (type === "receipt-to-stock") {
    sessionStorage.setItem("textiles-gh-flash", `Recepcion ${row[0]} verificada en inventario.`);
    navigate("inventarios", "productos");
  } else if (type === "quote-to-order") {
    const { documentNumber } = await nextTargetDocument("ventas", "pedidos");
    const detail = String(row[2] || "");
    const quantity = detail.match(/[+-]?\d+(?:[.,]\d+)?/)?.[0] || "1";
    const product = detail.replace(/^[+-]?\d+(?:[.,]\d+)?\s*(?:m|metros?|rollos?|piezas?)?\s*/i, "") || detail;
    await appendTargetRow("ventas", "pedidos", [documentNumber, row[1], product, quantity, "Detalle", row[3], row[4], "Pendiente"]);
    navigate("ventas", "pedidos");
  } else if (type === "order-to-invoice") {
    const today = new Intl.DateTimeFormat(activeUser().locale || "es-HN", { day: "numeric", month: "short", year: "numeric" })
      .format(new Date())
      .replace(".", "");
    const { targetView, documentNumber } = await nextTargetDocument("ventas", "facturas");
    const sequence = documentNumber.match(/(\d+)$/)?.[1] || "1";
    const correlative = `${targetView.autoCorrelative.prefix}-${sequence.padStart(targetView.autoCorrelative.digits, "0")}`;
    await appendTargetRow("ventas", "facturas", [documentNumber, row[1], correlative, today, row[6], "Borrador"]);
    navigate("ventas", "facturas");
  } else if (type === "invoice-to-payment") {
    await appendTargetRow("ventas", "cobranza", [row[0], row[1], row[3], row[4], row[4], "0-15 dias", "Por vencer"]);
    navigate("ventas", "cobranza");
  } else if (type === "client-to-collections") {
    navigate("ventas", "cobranza");
  }
}

function exportInventory() {
  const dataRows = filteredRows().map(({ row }) => row);
  const headers = [...currentView.columns];
  headers.splice(-1, 0, "No. de serie");
  headers.pop();
  const xmlCell = (value) => `<Cell><Data ss:Type="String">${escapeHtml(localizeBusinessText(value))}</Data></Cell>`;
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Inventario Textil"><Table><Row>${headers
    .map(xmlCell)
    .join("")}</Row>${dataRows.map((row) => `<Row>${row.map(xmlCell).join("")}</Row>`).join("")}</Table></Worksheet></Workbook>`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }));
  link.download = `inventario-textil-${(activeUser().companySlug || "empresa")}-${new Date().toISOString().slice(0, 10)}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast(`${dataRows.length} registros exportados a Excel.`);
}

function exportReport(index = 0) {
  const reportSources = [
    ["ventas", "facturas"],
    ["inventarios", "productos"],
    ["compras", "ordenes"],
    ["costos", "analisis"],
    ["ventas", "cobranza"],
    ["contabilidad", "movimientos"],
  ];
  const [targetModule, targetView] = currentView.type === "reports" ? reportSources[index] || ["ventas", "facturas"] : [currentKey, currentViewKey];
  const viewDef = modules[targetModule]?.views[targetView] || currentView;
  const datasetRows = targetModule === currentKey && targetView === currentViewKey ? rows : moduleRows(targetModule, targetView);
  const headers = [...(viewDef.columns || ["Columna"])];
  if (headers.at(-1) === "Acciones") {
    headers.splice(-1, 0, "No. de serie");
    headers.pop();
  }
  const csvCell = (val) => `"${String(localizeBusinessText(val ?? "")).replaceAll('"', '""')}"`;
  const csvLines = [headers.map(csvCell).join(","), ...datasetRows.map((row) => row.map(csvCell).join(","))];
  const title = reports[index]?.[0] || currentView.label;
  const blob = new Blob([`\ufeff${csvLines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${activeUser().companySlug || "erp"}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast(`Reporte "${title}" exportado en CSV (${datasetRows.length} registros).`);
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
    actionButton.textContent = "Recalculando...";
    window.setTimeout(() => {
      actionButton.disabled = false;
      actionButton.textContent = original;
      renderMetrics();
      showToast("Costos promedio y margenes textiles actualizados.");
    }, 600);
    return;
  }
  if (/exportar/i.test(currentView.action || "")) return exportReport();
}

function initializePage() {
  document.title = `Gestion Empresarial | ${currentModule.title} - ${currentView.label}`;
  document.querySelector("#module-title").textContent = currentModule.title;
  document.querySelector("#crumb-title").textContent = `${currentModule.title} / ${currentView.label}`;
  document.querySelector("#module-description").textContent = localizeBusinessText(currentView.description);
  document.querySelectorAll(".side-nav a").forEach((link) => link.classList.toggle("active", link.dataset.module === currentKey));
  renderTabs();
  renderMetrics();

  const hasValidPrimaryAction =
    Boolean(currentView.fields) ||
    currentView.type === "accounting-hub" ||
    currentView.specialAction === "recalculate" ||
    /exportar/i.test(currentView.action || "");
  actionButton.hidden = !currentView.action || !hasValidPrimaryAction;
  actionButton.textContent = currentView.action || "";
  actionButton.addEventListener("click", handlePrimaryAction);

  const flash = sessionStorage.getItem("textiles-gh-flash");
  if (flash) {
    sessionStorage.removeItem("textiles-gh-flash");
    showToast(flash);
  }

  if (currentView.type === "reports") return renderReports();
  if (currentView.type === "help") return renderGuides();
  if (currentView.type === "pos") return renderPos();
  if (currentView.type === "accounting-hub") return renderAccountingHub();

  toolbar.hidden = false;
  searchInput.placeholder = localizeBusinessText(currentView.search || "Buscar...");
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
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) return;
  if (button.dataset.action === "edit") openForm(index);
  if (button.dataset.action === "workflow") {
    button.disabled = true;
    const prevText = button.textContent;
    button.textContent = "Procesando...";
    try {
      await runWorkflow(index);
    } catch (error) {
      button.disabled = false;
      button.textContent = prevText;
      showToast(error.message, true);
    }
  }
  if (button.dataset.action === "delete") {
    button.disabled = true;
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
  const submitBtn = form.querySelector("button[type='submit']");
  const wasEditing = editIndex !== null;
  const data = new FormData(form);
  const values = currentView.fields.map(([, type], index) => formatFieldValue(data.get(`field-${index}`), type));
  values.push(wasEditing ? rows[editIndex].at(-1) : "Asignando...");
  if (wasEditing) rows[editIndex] = values;
  else rows.unshift(values);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando...";
  }
  try {
    closeForm();
    refreshDataView();
    await saveRows();
    showToast(wasEditing ? "Registro actualizado correctamente." : "Registro guardado correctamente.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar";
    }
  }
});

document.querySelector("#module-dialog-close").addEventListener("click", closeForm);
document.querySelector("#module-dialog-cancel").addEventListener("click", closeForm);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeForm();
});
window.addEventListener("storage", handleStoredRowsChange);
initializePage();
