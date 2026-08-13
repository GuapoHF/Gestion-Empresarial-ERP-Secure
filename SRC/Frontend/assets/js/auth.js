const passwordInput = document.querySelector("#password") || document.querySelector("#new-password");
const togglePasswordButton = document.querySelector("#toggle-password");
const loginForm = document.querySelector("#login-form");
const recoverForm = document.querySelector("#recover-form");
const recoverStatus = document.querySelector("#recover-status");
const usernameInput = document.querySelector("#username");
const loginAlert = document.querySelector("#login-alert");
const resetForm = document.querySelector("#reset-form");
const resetStatus = document.querySelector("#reset-status");

if (usernameInput && sessionStorage.getItem("gestionUser")) {
  usernameInput.value = sessionStorage.getItem("gestionUser");
}

if (togglePasswordButton && passwordInput) {
  togglePasswordButton.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePasswordButton.setAttribute("aria-label", isHidden ? "Ocultar contrasena" : "Mostrar contrasena");
  });
}
if (loginForm) {
  window.gestionUserDb.getStoredUsers();

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginAlert.hidden = true;

    const loggedUser = await window.gestionUserDb.loginUser(usernameInput.value, passwordInput.value);

    if (!loggedUser) {
      passwordInput.value = "";
      passwordInput.focus();
      loginAlert.hidden = false;
      return;
    }

    window.location.href = "./dashboard.html";
  });
}

if (recoverForm) {
  recoverForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = recoverForm.querySelector("#email").value;

    try {
      const result = await window.gestionUserDb.recoverPassword(email);
      recoverStatus.querySelector("p").innerHTML = `${result.message} <span>Revisa tu bandeja de entrada.</span>`;
      recoverStatus.hidden = false;
    } catch (error) {
      recoverStatus.querySelector("p").textContent = error.message;
      recoverStatus.hidden = false;
    }
  });
}

if (resetForm) {
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = new URLSearchParams(window.location.search).get("token");
    const password = resetForm.querySelector("#new-password").value;

    try {
      const result = await window.gestionUserDb.resetPassword(token, password);
      resetStatus.querySelector("p").innerHTML = `${result.message} <span>Ya puedes iniciar sesion.</span>`;
      resetStatus.hidden = false;
      resetForm.reset();
    } catch (error) {
      resetStatus.querySelector("p").textContent = error.message;
      resetStatus.hidden = false;
    }
  });
}
