const ADMIN_ROLE = "Administrador";

function getSessionUser() {
  return window.gestionUserDb?.getCurrentUser() || null;
}

function isAdminUser(user) {
  return user?.role === ADMIN_ROLE;
}

function getInitials(user) {
  const firstInitial = user?.firstName?.trim().charAt(0) || "";
  const lastInitial = user?.lastName?.trim().charAt(0) || "";
  return `${firstInitial}${lastInitial}`.toUpperCase() || "U";
}

function applyRegionalSettings(user) {
  const isMexico = user.countryCode === 'MX';
  const taxName = isMexico ? 'IVA' : 'ISV';
  const authority = isMexico ? 'SAT' : 'SAR';
  document.documentElement.lang = isMexico ? 'es-MX' : 'es-HN';
  document.body.dataset.country = user.countryCode || 'HN';

  const businessName = document.querySelector('#business-name');
  if (businessName) businessName.value = user.company;
  const taxIdLabel = document.querySelector('label[for="business-rtn"]');
  if (taxIdLabel) taxIdLabel.textContent = `${user.taxIdLabel} (${isMexico ? 'Registro Federal de Contribuyentes' : 'Registro Tributario Nacional'})`;
  const taxIdInput = document.querySelector('#business-rtn');
  if (taxIdInput) {
    taxIdInput.value = user.taxId || '';
    taxIdInput.inputMode = isMexico ? 'text' : 'numeric';
    taxIdInput.maxLength = isMexico ? 13 : 14;
    taxIdInput.removeAttribute('pattern');
  }
  const exchangeLabel = document.querySelector('label[for="exchange-rate"]');
  if (exchangeLabel) exchangeLabel.textContent = `Tasa de Cambio Oficial (USD a ${user.currencyCode})`;
  const exchangePrefix = document.querySelector('#exchange-rate')?.previousElementSibling;
  if (exchangePrefix) exchangePrefix.textContent = user.currencySymbol;
  const taxLabel = document.querySelector('label[for="sales-tax"]');
  if (taxLabel) taxLabel.textContent = `${isMexico ? 'Impuesto al Valor Agregado' : 'Impuesto sobre Ventas'} (${taxName})`;
  const taxInput = document.querySelector('#sales-tax');
  if (taxInput) taxInput.value = String(user.taxRate);
  const taxHelp = taxInput?.closest('.config-field')?.querySelector('small');
  if (taxHelp) taxHelp.textContent = `Tasa estandar ${user.countryName}: ${user.taxRate}%. Los conceptos exentos utilizan 0%.`;
  const billingTitle = document.querySelector('#billing-title');
  if (billingTitle) billingTitle.textContent = `Parametros de Facturacion ${authority}`;
  const billingDescription = billingTitle?.nextElementSibling;
  if (billingDescription) billingDescription.textContent = isMexico ? 'Configuracion fiscal para CFDI y folios autorizados por el SAT.' : 'Autorizacion de facturacion emitida por el SAR de Honduras.';
  const authorizationLabel = document.querySelector('label[for="billing-cai"]');
  if (authorizationLabel) authorizationLabel.textContent = isMexico ? 'Serie, folio y datos del CFDI' : 'CAI - Clave de Autorizacion de Impresion';

  const socialSecurityLabel = document.querySelector('label[for="imss"]');
  if (socialSecurityLabel) socialSecurityLabel.textContent = isMexico ? 'IMSS / Seguro Social' : 'IHSS / Seguro Social';
  const identityLabel = document.querySelector('label[for="curp"]');
  if (identityLabel) identityLabel.textContent = isMexico ? 'CURP / Identidad' : 'DNI / Identidad';
  const employeeTaxLabel = document.querySelector('label[for="rfc"]');
  if (employeeTaxLabel) employeeTaxLabel.textContent = isMexico ? 'RFC' : 'RTN';

  const localCurrency = document.querySelector('input[name="currency"]:not([value="USD"])');
  if (localCurrency) {
    localCurrency.value = user.currencyCode;
    const optionText = localCurrency.closest('label')?.querySelector('span');
    if (optionText) optionText.innerHTML = `${isMexico ? 'Pesos mexicanos' : 'Lempiras'} <small>${user.currencyCode}</small>`;
  }
  const incomeExchangeLabel = document.querySelector('label[for="exchangeRate"]');
  if (incomeExchangeLabel) incomeExchangeLabel.childNodes[0].nodeValue = `Tasa de cambio a ${user.currencyCode} `;
  const incomeExchangePrefix = document.querySelector('#exchangeRate')?.previousElementSibling;
  if (incomeExchangePrefix) incomeExchangePrefix.textContent = user.currencySymbol;
  document.querySelectorAll('.results-grid').forEach((grid) => {
    const description = grid.previousElementSibling;
    if (description?.tagName === 'P') description.textContent = `Calculado automaticamente en ${user.currencyCode}.`;
  });
  if (isMexico) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (!['SCRIPT', 'STYLE'].includes(walker.currentNode.parentElement?.tagName)) nodes.push(walker.currentNode);
    }
    nodes.forEach((node) => {
      node.nodeValue = node.nodeValue
        .replaceAll('HNL', 'MXN')
        .replaceAll('RTN', 'RFC')
        .replaceAll('ISV', 'IVA')
        .replaceAll('SAR', 'SAT')
        .replace(/(^|\s)L\s(?=\d)/g, '$1$ ');
    });
  }
}

function applySessionUser(user) {
  document.querySelectorAll('.user-box').forEach((box) => {
    const avatar = box.querySelector('.avatar');
    const username = box.querySelector('strong');
    const role = box.querySelector('span');

    if (avatar) avatar.textContent = getInitials(user);
    if (username) username.textContent = user.username;
    if (role) role.textContent = user.role;
  });
  document.querySelectorAll('.brand').forEach((brand) => {
    if (!brand.dataset.staticBrand && user.company) brand.childNodes[0].nodeValue = `${user.company}`;
  });
  document.querySelectorAll('[data-session-company]').forEach((element) => {
    element.textContent = user.company;
  });
  applyRegionalSettings(user);
}
function hideAdminAccess() {
  document.querySelectorAll('a[href="./admin.html"], a[href="admin.html"], a[data-module="administrador"]').forEach((link) => {
    const card = link.classList.contains('module-card') || link.classList.contains('admin-card') ? link : null;
    (card || link).hidden = true;
  });
}

function setupLogout() {
  document.querySelectorAll('.logout').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      await window.gestionUserDb?.logoutUser();
      window.location.href = './login.html';
    });
  });
}

const currentUser = getSessionUser();

if (!currentUser) {
  window.location.href = './login.html';
} else if (document.body.dataset.adminOnly === 'true' && !isAdminUser(currentUser)) {
  window.location.href = './dashboard.html';
} else {
  applySessionUser(currentUser);

  if (!isAdminUser(currentUser)) {
    hideAdminAccess();
  }

  setupLogout();
  window.gestionUserDb.validateSession().then((validatedUser) => {
    if (!validatedUser) {
      window.location.href = './login.html';
      return;
    }
    if (document.body.dataset.adminOnly === 'true' && !isAdminUser(validatedUser)) {
      window.location.href = './dashboard.html';
      return;
    }
    applySessionUser(validatedUser);
  });
}
