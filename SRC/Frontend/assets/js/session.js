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

function applySessionUser(user) {
  document.querySelectorAll('.user-box').forEach((box) => {
    const avatar = box.querySelector('.avatar');
    const username = box.querySelector('strong');
    const role = box.querySelector('span');

    if (avatar) avatar.textContent = getInitials(user);
    if (username) username.textContent = user.username;
    if (role) role.textContent = user.role;
  });
}

function hideAdminAccess() {
  document.querySelectorAll('a[href="./admin.html"], a[href="admin.html"], a[data-module="administrador"]').forEach((link) => {
    const card = link.classList.contains('module-card') || link.classList.contains('admin-card') ? link : null;
    (card || link).hidden = true;
  });
}

function setupLogout() {
  document.querySelectorAll('.logout').forEach((link) => {
    link.addEventListener('click', () => {
      window.gestionUserDb?.logoutUser();
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
}
