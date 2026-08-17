const pool = require("../config/connection");
const { requireModuleAccess } = require("../config/permissions");

const REPORT_TYPES = ["income-statement", "balance-sheet", "trial-balance", "payroll-catalog", "sales-profit", "purchase-invoice"];

const ACCOUNT_SEED = [
  ["112-000-000", "Bancos", "ASSET_CURRENT", 3545642.94, 3454142.74, 1529049.47],
  ["115-000-000", "Clientes", "ASSET_CURRENT", 10748272.43, 1848866.19, 196959.72],
  ["117-000-000", "Deudores diversos", "ASSET_CURRENT", 9942266.08, 468995.00, 0],
  ["119-000-000", "Inventarios", "ASSET_CURRENT", 37244282.68, 474897.68, 2924003.46],
  ["121-000-000", "Pagos anticipados", "ASSET_CURRENT", 9450.00, 0, 0],
  ["131-000-000", "Propiedades, planta y equipo", "ASSET_NONCURRENT", 734462.97, 0, 0],
  ["138-000-000", "Depreciacion acumulada", "ASSET_NONCURRENT", -116290.07, 0, 6120.53],
  ["211-000-000", "Proveedores", "LIABILITY_CURRENT", -310770.17, 0, 0],
  ["212-000-000", "Acreedores diversos", "LIABILITY_CURRENT", -1467780.90, 0, 0],
  ["215-000-000", "Impuestos y contribuciones retenidos", "LIABILITY_CURRENT", -817.43, 7737.08, 10301.05],
  ["216-000-000", "Provision de nomina", "LIABILITY_CURRENT", -5400.43, 0, 0],
  ["219-000-000", "Anticipos de clientes", "LIABILITY_CURRENT", -7617027.48, 9683.00, 23169.75],
  ["310-000-000", "Capital social", "EQUITY", -5000.00, 0, 0],
  ["330-000-000", "Resultado de ejercicios anteriores", "EQUITY", -53011816.52, 0, 0],
  ["410-000-000", "Ventas", "INCOME", 0, 0, 5091248.40],
  ["500-000-000", "Costo de ventas", "COST", 0, 2924003.46, 0],
  ["510-000-000", "Compras", "COST", 0, 0, 0],
  ["600-000-000", "Gastos generales", "EXPENSE", 0, 910926.18, 0],
  ["710-000-000", "Productos financieros", "OTHER_INCOME", 0, 0, 21040.35],
  ["720-000-000", "Gastos financieros", "OTHER_EXPENSE", 0, 9560.58, 0],
];

const PAYROLL_SEED_MX = [
  ["P001", "Sueldo", "Normal", "Si", "Gravable", "No", "Fija", "0.00"],
  ["P003", "Horas extras dobles", "Normal", "No", "Individual", "No", "Variable", "0.00"],
  ["P004", "Aguinaldo", "Normal", "Si", "Individual", "No", "Fija", "0.00"],
  ["P005", "Horas extras triples", "Normal", "No", "Individual", "No", "Variable", "0.00"],
  ["P006", "Fondo de ahorro patron", "Normal", "Si", "General", "Si", "Variable", "0.00"],
  ["P007", "Prestamo del fondo", "Normal", "No", "Individual", "No", "Fija", "0.00"],
  ["P008", "Intereses del fondo", "Normal", "No", "General", "No", "Fija", "0.00"],
  ["P009", "Vacaciones", "Normal", "No", "Individual", "Si", "Variable", "0.00"],
  ["P010", "Prima vacacional", "Normal", "Si", "Individual", "Si", "Fija", "0.00"],
  ["P011", "Reparto de utilidades", "Normal", "Si", "Individual", "No", "Variable", "0.00"],
  ["P012", "Alimentacion", "Alta", "No", "General", "No", "Variable", "0.00"],
  ["P013", "Habitacion", "Inactiva", "No", "Individual", "Si", "Variable", "0.00"],
  ["P014", "Despensa", "Alta", "No", "Individual", "No", "Variable", "0.00"],
  ["P015", "Premios de asistencia", "Inactiva", "No", "General", "Si", "Fija", "0.00"],
  ["P016", "Premios de puntualidad", "Inactiva", "No", "Individual", "No", "Variable", "0.00"],
  ["P017", "Bono anual", "Alta", "No", "General", "No", "Fija", "0.00"],
  ["P018", "Prestamo personal", "Alta", "No", "General", "No", "Fija", "218693.53"],
  ["P019", "Prima dominical", "Alta", "No", "Individual", "No", "Variable", "0.00"],
  ["P020", "Subsidios por incapacidad", "Alta", "No", "Individual", "No", "Variable", "9052.00"],
  ["P021", "Vacaciones", "Alta", "No", "General", "No", "Fija", "138383.17"],
  ["P022", "Prima vacacional", "Alta", "No", "General", "No", "Fija", "37328.64"],
  ["P023", "Gratificacion especial", "Alta", "No", "General", "No", "Fija", "0.00"],
  ["P024", "Reparto de utilidades", "Alta", "Si", "General", "No", "Fija", "0.00"],
  ["P027", "Vacaciones pagadas", "Alta", "No", "General", "No", "Fija", "0.00"],
  ["P028", "Diferencia de sueldo", "Alta", "No", "General", "No", "Fija", "0.00"],
  ["P099", "Ayuda para gastos funerarios", "Alta", "No", "General", "No", "Fija", "2130.05"],
  ["P100", "Ingresos por retiro", "Calculo", "No", "Individual", "No", "Variable", "0.00"],
  ["P101", "Ingresos exentos por retiro", "Calculo", "No", "Individual", "No", "Variable", "0.00"],
  ["P103", "Indemnizacion", "Alta", "No", "Individual", "No", "Variable", "0.00"],
  ["P104", "Prima de antiguedad", "Alta", "No", "General", "No", "Variable", "0.00"],
  ["P105", "ISR ajustado por subsidio", "Calculo", "No", "Individual", "No", "Fija", "0.00"],
  ["P106", "Subsidio efectivo entregado", "Calculo", "No", "General", "No", "Fija", "0.00"],
  ["P108", "ISR", "Alta", "No", "General", "No", "Fija", "0.00"],
  ["D001", "IMSS", "Alta", "No", "General", "No", "Fija", "97766.42"],
  ["D003", "Anticipo de nomina", "Alta", "No", "Individual", "No", "Variable", "2381.92"],
  ["D004", "Prestamo personal", "Alta", "No", "Individual", "No", "Variable", "7500.00"],
  ["D005", "Fondo de ahorro", "Inactiva", "No", "General", "No", "Fija", "0.00"],
  ["D006", "Alimentacion", "Alta", "No", "Individual", "No", "Variable", "0.00"],
  ["D007", "Habitacion", "Alta", "No", "Individual", "No", "Variable", "0.00"],
  ["D010", "Pension alimenticia", "Alta", "No", "Individual", "No", "Variable", "0.00"],
  ["D020", "Permisos sin sueldo", "Alta", "No", "General", "No", "Variable", "5079.21"],
  ["D091", "SAR voluntario", "Alta", "No", "Individual", "No", "Variable", "0.00"],
  ["D092", "INFONAVIT voluntario", "Alta", "No", "Individual", "No", "Variable", "16800.00"],
  ["D093", "Credito FONACOT", "Alta", "No", "Individual", "No", "Variable", "0.00"],
  ["D094", "Credito INFONAVIT", "Alta", "No", "Individual", "No", "Variable", "0.00"],
  ["D100", "Subsidio para el empleo", "Calculo", "No", "General", "No", "Fija", "0.00"],
  ["D101", "Impuesto local", "Alta", "No", "General", "No", "Variable", "0.00"],
  ["D102", "ISR de ingreso por retiro", "Alta", "No", "General", "No", "Variable", "0.00"],
  ["D103", "Ajuste al subsidio causado", "Calculo", "No", "General", "No", "Fija", "0.00"],
  ["D110", "Ajuste en subsidio al empleo", "Calculo", "No", "General", "No", "Fija", "0.00"],
  ["D111", "Subsidio para el empleo aplicado", "Calculo", "No", "General", "No", "Fija", "65806.89"],
  ["D112", "Compensacion de ISR", "Alta", "No", "General", "No", "Fija", "0.00"],
];

const PAYROLL_SEED_HN = [
  ["P001", "Sueldo ordinario", "Activo", "Si", "General", "Si", "Fija", "0.00"],
  ["P002", "Horas extras", "Activo", "Si", "Individual", "No", "Variable", "0.00"],
  ["P003", "Comisiones", "Activo", "Si", "Individual", "No", "Variable", "0.00"],
  ["P004", "Decimotercer mes", "Activo", "No", "General", "Si", "Fija", "0.00"],
  ["P005", "Decimocuarto mes", "Activo", "No", "General", "Si", "Fija", "0.00"],
  ["P006", "Vacaciones", "Activo", "Si", "Individual", "Si", "Variable", "0.00"],
  ["P007", "Bonificaciones", "Activo", "Si", "Individual", "No", "Variable", "0.00"],
  ["P008", "Viaticos", "Activo", "No", "Individual", "No", "Variable", "0.00"],
  ["P009", "Auxilio de cesantia", "Activo", "No", "Individual", "Si", "Variable", "0.00"],
  ["D001", "Aporte IHSS trabajador", "Activo", "No", "General", "No", "Fija", "0.00"],
  ["D002", "Aporte RAP trabajador", "Activo", "No", "General", "No", "Fija", "0.00"],
  ["D003", "Retencion ISR", "Activo", "No", "Individual", "No", "Variable", "0.00"],
  ["D004", "Anticipo de salario", "Activo", "No", "Individual", "No", "Variable", "0.00"],
  ["D005", "Prestamo personal", "Activo", "No", "Individual", "No", "Fija", "0.00"],
  ["D006", "Pension alimenticia", "Activo", "No", "Individual", "No", "Fija", "0.00"],
  ["D007", "Aporte cooperativa", "Activo", "No", "Individual", "No", "Fija", "0.00"],
  ["D008", "Ausencias y llegadas tarde", "Activo", "No", "Individual", "No", "Variable", "0.00"],
  ["D009", "Embargo judicial", "Activo", "No", "Individual", "No", "Fija", "0.00"],
];

const SALES_PRODUCTS = [
  ["032JBK", "Tela jersey tubular negro", 25.17, 24.09],
  ["032JBL", "Tela jersey tubular blanco", 24.80, 25.60],
  ["032CRUDO", "Tela cruda jersey algodon", 8.56, 18.72],
  ["03WIPER", "Wiper crudo French Terry", 2.41, 6.42],
  ["052JBK", "Tela jersey tubular negro", 25.17, 24.09],
];

const PURCHASE_LINES = [
  ["10700052", "Desperdicio corte colores", "Colores", 6091, "LB", 0.0200],
  ["10700076", "Desperdicio corte 100% poly", "Blanco", 222, "LB", 0.0050],
  ["10700077", "Desperdicio corte 100% poly", "Blanco", 1642, "LB", 0.0050],
  ["10700093", "Desperdicio corte tejido plano", "Surtido", 3687, "LB", 0.0405],
  ["10700093", "Desperdicio corte tejido plano", "San/Tej", 3687, "LB", 0.0405],
  ["10200001", "Sacos plasticos", "", 58, "LB", 0.0620],
  ["10700003", "Desperdicio corte colores", "100C", 4728, "LB", 0.0500],
  ["10700005", "Desperdicio de tela cruda", "", 41, "LB", 0.2500],
  ["10700013", "Desperdicio seamless colores", "Blanco", 216, "LB", 0.0130],
  ["10700018", "Desperdicio de tela mojada", "", 484, "LB", 0.0250],
  ["10700020", "Desperdicios de carton", "", 660, "LB", 0.0250],
  ["10700022", "Desperdicios de nylon seco", "", 790, "LB", 0.1250],
  ["10700023", "Desperdicios de nylon mojado", "", 80, "LB", 0.0620],
  ["10700030", "Desperdicio de wiper colores", "", 745, "LB", 0.1500],
  ["10700042", "Desperdicio rollos indigo", "", 1244, "LB", 0.0500],
  ["10700049", "Desperdicio textil calidad", "", 218, "LB", 0.0200],
];

function salesSeedRows() {
  return Array.from({ length: 96 }, (_, index) => {
    const product = SALES_PRODUCTS[index % SALES_PRODUCTS.length];
    const quantity = index < 2 ? [3550, 5832][index] : 20 + ((index * 7) % 36);
    const unitCost = product[2];
    const unitPrice = product[3];
    return [`${product[0]}${String(1001 + index).padStart(5, "0")}`, product[1], quantity, quantity * unitCost, quantity * unitPrice];
  });
}

function resolveCompanyId(user, requestedCompanyId) {
  return user.isGlobalAdmin && requestedCompanyId ? Number(requestedCompanyId) : Number(user.companyId);
}

async function ensureAccountingTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS accounting_balances (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    period CHAR(7) NOT NULL,
    account_code VARCHAR(30) NOT NULL,
    account_name VARCHAR(180) NOT NULL,
    account_type VARCHAR(40) NOT NULL,
    opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
    debit DECIMAL(18,2) NOT NULL DEFAULT 0,
    credit DECIMAL(18,2) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_accounting_balance (company_id, period, account_code)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS payroll_concepts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    concept_key VARCHAR(20) NOT NULL,
    description VARCHAR(180) NOT NULL,
    status VARCHAR(30) NOT NULL,
    integrates_salary VARCHAR(10) NOT NULL,
    calculation_scope VARCHAR(30) NOT NULL,
    benefit VARCHAR(10) NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    accumulated DECIMAL(18,2) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_payroll_concept (company_id, concept_key)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sales_profit_lines (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    period CHAR(7) NOT NULL,
    product_code VARCHAR(40) NOT NULL,
    description VARCHAR(180) NOT NULL,
    quantity DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(18,2) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_sales_profit_line (company_id, period, product_code)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS purchase_invoices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    supplier VARCHAR(180) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(30) NOT NULL DEFAULT 'Recibida',
    net_weight DECIMAL(18,2) NOT NULL DEFAULT 0,
    gross_weight DECIMAL(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_purchase_invoice (company_id, invoice_number)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    work_order VARCHAR(30) NOT NULL,
    style_code VARCHAR(30) NOT NULL,
    description VARCHAR(180) NOT NULL,
    color VARCHAR(80),
    quantity DECIMAL(18,2) NOT NULL DEFAULT 0,
    unit VARCHAR(10) NOT NULL,
    unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
    line_total DECIMAL(18,2) NOT NULL DEFAULT 0,
    INDEX idx_purchase_invoice_lines (invoice_id)
  )`);
}

async function seedAccounting(company, period) {
  const companyId = Number(company.id);
  await ensureAccountingTables();
  const [existing] = await pool.query("SELECT id FROM accounting_balances WHERE company_id = ? AND period = ? LIMIT 1", [companyId, period]);
  if (!existing.length) {
    for (const row of ACCOUNT_SEED) {
      await pool.query(
        `INSERT INTO accounting_balances
         (company_id, period, account_code, account_name, account_type, opening_balance, debit, credit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, period, ...row]
      );
    }
  }
  const payrollSeed = company.country_code === "MX" ? PAYROLL_SEED_MX : PAYROLL_SEED_HN;
  const [payrollCount] = await pool.query("SELECT COUNT(*) total FROM payroll_concepts WHERE company_id = ?", [companyId]);
  if (Number(payrollCount[0].total) !== payrollSeed.length) {
    await pool.query("DELETE FROM payroll_concepts WHERE company_id = ?", [companyId]);
    for (const row of payrollSeed) {
      await pool.query(
        `INSERT INTO payroll_concepts
         (company_id, concept_key, description, status, integrates_salary, calculation_scope, benefit, movement_type, accumulated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), status = VALUES(status), integrates_salary = VALUES(integrates_salary),
         calculation_scope = VALUES(calculation_scope), benefit = VALUES(benefit), movement_type = VALUES(movement_type), accumulated = VALUES(accumulated)`,
        [companyId, ...row]
      );
    }
  }
  const [sales] = await pool.query("SELECT id FROM sales_profit_lines WHERE company_id = ? AND period = ? LIMIT 1", [companyId, period]);
  if (!sales.length) {
    for (const row of salesSeedRows()) {
      await pool.query(
        `INSERT INTO sales_profit_lines (company_id, period, product_code, description, quantity, total_cost, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [companyId, period, ...row]
      );
    }
  }
  const invoiceNumber = "000-001-01-00100628";
  await pool.query(
    `INSERT INTO purchase_invoices
     (company_id, invoice_number, supplier, issue_date, due_date, currency, status, net_weight, gross_weight)
     VALUES (?, ?, ?, ?, ?, 'USD', 'Recibida', 20906, 9482.90)
     ON DUPLICATE KEY UPDATE supplier = VALUES(supplier), issue_date = VALUES(issue_date), due_date = VALUES(due_date)`,
    [companyId, invoiceNumber, "ELCATEX S. de R.L. de C.V.", "2025-07-09", "2025-07-09"]
  );
  const [invoiceRows] = await pool.query("SELECT id FROM purchase_invoices WHERE company_id = ? AND invoice_number = ? LIMIT 1", [companyId, invoiceNumber]);
  const invoiceId = invoiceRows[0].id;
  const [invoiceLineCount] = await pool.query("SELECT COUNT(*) total FROM purchase_invoice_lines WHERE invoice_id = ?", [invoiceId]);
  if (!Number(invoiceLineCount[0].total)) {
    for (let index = 0; index < PURCHASE_LINES.length; index += 1) {
      const [styleCode, description, color, quantity, unit, unitPrice] = PURCHASE_LINES[index];
      await pool.query(
        `INSERT INTO purchase_invoice_lines
         (invoice_id, work_order, style_code, description, color, quantity, unit, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invoiceId, String(102000 + index), styleCode, description, color, quantity, unit, unitPrice, quantity * unitPrice]
      );
    }
  }
}

function number(value) { return Number(value || 0); }
function closing(row) { return number(row.opening_balance) + number(row.debit) - number(row.credit); }
function sum(rows, type) { return rows.filter((row) => row.account_type === type).reduce((total, row) => total + Math.abs(closing(row)), 0); }

async function getAccountingReport(user, query) {
  requireModuleAccess(user, "contabilidad");
  const type = String(query.type || "income-statement");
  if (!REPORT_TYPES.includes(type)) throw new Error("El tipo de reporte contable no es valido.");
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.period || "") ? query.period : "2026-01";
  const companyId = resolveCompanyId(user, query.companyId);
  const [companies] = await pool.query("SELECT * FROM companies WHERE id = ? AND active = 1 LIMIT 1", [companyId]);
  if (!companies.length) throw new Error("La empresa solicitada no existe.");
  const company = companies[0];
  await seedAccounting(company, period);

  if (type === "payroll-catalog") {
    const [concepts] = await pool.query("SELECT * FROM payroll_concepts WHERE company_id = ? ORDER BY concept_key", [companyId]);
    return { type, period, company, concepts };
  }

  if (type === "sales-profit") {
    const [lines] = await pool.query(
      "SELECT product_code, description, quantity, total_cost, total_price FROM sales_profit_lines WHERE company_id = ? AND period = ? ORDER BY product_code",
      [companyId, period]
    );
    const rows = lines.map((row) => {
      const cost = number(row.total_cost);
      const price = number(row.total_price);
      const utility = price - cost;
      return {
        code: row.product_code,
        description: row.description,
        quantity: number(row.quantity),
        cost,
        price,
        utility,
        utilityPercent: cost ? (utility / cost) * 100 : 0,
        margin: price ? (utility / price) * 100 : 0,
      };
    });
    return {
      type, period, company, rows,
      filters: { product: "Todos", customer: "Todos", seller: "Todos", documentType: "Todos", currency: company.currency_code },
      totals: rows.reduce((totals, row) => ({
        quantity: totals.quantity + row.quantity,
        cost: totals.cost + row.cost,
        price: totals.price + row.price,
        utility: totals.utility + row.utility,
      }), { quantity: 0, cost: 0, price: 0, utility: 0 }),
    };
  }

  if (type === "purchase-invoice") {
    const [invoices] = await pool.query(
      "SELECT * FROM purchase_invoices WHERE company_id = ? ORDER BY issue_date DESC, id DESC LIMIT 1",
      [companyId]
    );
    const invoice = invoices[0];
    const [lines] = await pool.query("SELECT * FROM purchase_invoice_lines WHERE invoice_id = ? ORDER BY id", [invoice.id]);
    return {
      type, period, company,
      invoice: {
        number: invoice.invoice_number,
        supplier: invoice.supplier,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        currency: invoice.currency,
        status: invoice.status,
        netWeight: number(invoice.net_weight),
        grossWeight: number(invoice.gross_weight),
      },
      lines: lines.map((row) => ({
        workOrder: row.work_order,
        styleCode: row.style_code,
        description: row.description,
        color: row.color || "",
        quantity: number(row.quantity),
        unit: row.unit,
        unitPrice: number(row.unit_price),
        total: number(row.line_total),
      })),
      totals: { subtotal: lines.reduce((total, row) => total + number(row.line_total), 0), tax: 0 },
    };
  }

  const [rows] = await pool.query("SELECT * FROM accounting_balances WHERE company_id = ? AND period = ? ORDER BY account_code", [companyId, period]);
  if (type === "trial-balance") {
    return {
      type, period, company,
      rows: rows.map((row) => ({ code: row.account_code, name: row.account_name, opening: number(row.opening_balance), debit: number(row.debit), credit: number(row.credit), closing: closing(row) })),
      totals: { opening: rows.reduce((t, r) => t + number(r.opening_balance), 0), debit: rows.reduce((t, r) => t + number(r.debit), 0), credit: rows.reduce((t, r) => t + number(r.credit), 0), closing: rows.reduce((t, r) => t + closing(r), 0) },
    };
  }
  if (type === "income-statement") {
    const income = sum(rows, "INCOME");
    const cost = sum(rows, "COST");
    const expenses = sum(rows, "EXPENSE");
    const otherIncome = sum(rows, "OTHER_INCOME");
    const otherExpense = sum(rows, "OTHER_EXPENSE");
    const grossProfit = income - cost;
    const operatingProfit = grossProfit - expenses;
    const netProfit = operatingProfit + otherIncome - otherExpense;
    return { type, period, company, income, cost, grossProfit, expenses, operatingProfit, otherIncome, otherExpense, taxes: 0, netProfit };
  }
  const currentAssets = sum(rows, "ASSET_CURRENT");
  const nonCurrentAssets = sum(rows, "ASSET_NONCURRENT");
  const currentLiabilities = sum(rows, "LIABILITY_CURRENT");
  const longLiabilities = sum(rows, "LIABILITY_LONG");
  const equity = sum(rows, "EQUITY");
  return {
    type, period, company,
    sections: {
      currentAssets: rows.filter(r => r.account_type === "ASSET_CURRENT").map(r => ({ name: r.account_name, amount: Math.abs(closing(r)) })),
      nonCurrentAssets: rows.filter(r => r.account_type === "ASSET_NONCURRENT").map(r => ({ name: r.account_name, amount: Math.abs(closing(r)) })),
      currentLiabilities: rows.filter(r => r.account_type === "LIABILITY_CURRENT").map(r => ({ name: r.account_name, amount: Math.abs(closing(r)) })),
      longLiabilities: rows.filter(r => r.account_type === "LIABILITY_LONG").map(r => ({ name: r.account_name, amount: Math.abs(closing(r)) })),
      equity: rows.filter(r => r.account_type === "EQUITY").map(r => ({ name: r.account_name, amount: Math.abs(closing(r)) })),
    },
    totals: { currentAssets, nonCurrentAssets, assets: currentAssets + nonCurrentAssets, currentLiabilities, longLiabilities, equity, liabilitiesAndEquity: currentLiabilities + longLiabilities + equity },
  };
}

module.exports = { ensureAccountingTables, getAccountingReport };
