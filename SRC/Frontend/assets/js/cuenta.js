const accountUser = window.gestionUserDb.getCurrentUser();
const accountDialog = document.querySelector("#delete-account-dialog");
const accountForm = document.querySelector("#delete-account-form");
const accountPassword = document.querySelector("#delete-account-password");
const accountConfirmation = document.querySelector("#delete-account-confirmation");
const accountError = document.querySelector("#delete-account-error");

if (accountUser) {

function accountInitials(user) {
  return `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase() || "U";
}

document.querySelector("#account-avatar").textContent = accountInitials(accountUser);
document.querySelector("#account-full-name").textContent = [accountUser.firstName, accountUser.lastName, accountUser.secondLastName].filter(Boolean).join(" ");
document.querySelector("#account-username").textContent = accountUser.username;
document.querySelector("#account-email").textContent = accountUser.email;
document.querySelector("#account-company").textContent = `${accountUser.company} - ${accountUser.countryName}`;
document.querySelector("#account-role").textContent = accountUser.isGlobalAdmin ? `${accountUser.role} global` : accountUser.role;

document.querySelector("#open-delete-account").addEventListener("click", () => {
  accountForm.reset();
  accountError.hidden = true;
  accountDialog.showModal();
  accountPassword.focus();
});
document.querySelector("#cancel-delete-account").addEventListener("click", () => accountDialog.close());
document.querySelector("#toggle-account-password").addEventListener("click", () => {
  const hidden = accountPassword.type === "password";
  accountPassword.type = hidden ? "text" : "password";
  document.querySelector("#toggle-account-password").setAttribute("aria-label", hidden ? "Ocultar contrasena" : "Mostrar contrasena");
});

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accountError.hidden = true;
  if (accountConfirmation.value.trim().toUpperCase() !== "ELIMINAR MI CUENTA") {
    accountError.textContent = "Escribe ELIMINAR MI CUENTA exactamente para continuar.";
    accountError.hidden = false;
    accountConfirmation.focus();
    return;
  }
  const submitButton = accountForm.querySelector("button[type='submit']");
  try {
    submitButton.disabled = true;
    submitButton.textContent = "Eliminando cuenta...";
    await window.gestionUserDb.deleteOwnAccount(accountPassword.value, accountConfirmation.value);
    window.location.replace("./login.html?cuenta=eliminada");
  } catch (error) {
    accountError.textContent = error.message;
    accountError.hidden = false;
    accountPassword.value = "";
    accountPassword.focus();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Eliminar definitivamente";
  }
});
}
