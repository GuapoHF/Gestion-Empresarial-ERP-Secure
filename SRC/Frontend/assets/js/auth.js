const passwordInput = document.querySelector("#password") || document.querySelector("#new-password");
const togglePasswordButton = document.querySelector("#toggle-password");
const loginForm = document.querySelector("#login-form");
const recoverForm = document.querySelector("#recover-form");
const recoverStatus = document.querySelector("#recover-status");
const usernameInput = document.querySelector("#username");
const loginAlert = document.querySelector("#login-alert");
const resetForm = document.querySelector("#reset-form");
const resetStatus = document.querySelector("#reset-status");
const validation = window.gestionValidation;

if (usernameInput && sessionStorage.getItem("gestionUser")) {
  usernameInput.value = sessionStorage.getItem("gestionUser");
}

if (loginAlert && new URLSearchParams(window.location.search).get("cuenta") === "eliminada") {
  loginAlert.querySelector("span").textContent = "Tu cuenta fue eliminada y todas las sesiones quedaron cerradas.";
  loginAlert.classList.add("success-alert");
  loginAlert.hidden = false;
}

if (togglePasswordButton && passwordInput) {
  togglePasswordButton.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePasswordButton.setAttribute("aria-label", isHidden ? "Ocultar contrasena" : "Mostrar contrasena");
  });
}
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginAlert.hidden = true;
    loginAlert.classList.remove("success-alert");
    const submitButton = loginForm.querySelector("button[type='submit']");
    try {
      submitButton.disabled = true;
      submitButton.textContent = "Iniciando sesion...";
      const loggedUser = await window.gestionUserDb.loginUser(usernameInput.value, passwordInput.value);
      if (!loggedUser) {
        passwordInput.value = "";
        passwordInput.focus();
        loginAlert.querySelector("span").textContent = "Usuario o contrasena incorrectos, o la cuenta sigue pendiente.";
        loginAlert.hidden = false;
        return;
      }
      window.location.href = "./dashboard.html";
    } catch (error) {
      loginAlert.querySelector("span").textContent = error.message;
      loginAlert.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Iniciar Sesion";
    }
  });
}

if (recoverForm) {
  const recoverEmail = recoverForm.querySelector("#email");
  recoverEmail.addEventListener("blur", () => {
    recoverEmail.value = validation.normalizeEmail(recoverEmail.value);
    validation.setFieldError(recoverEmail, validation.emailError(recoverEmail.value));
  });
  recoverEmail.addEventListener("input", () => validation.setFieldError(recoverEmail, ""));
  recoverForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    recoverEmail.value = validation.normalizeEmail(recoverEmail.value);
    const message = validation.emailError(recoverEmail.value);
    validation.setFieldError(recoverEmail, message);
    if (message) {
      recoverEmail.focus();
      return;
    }
    const email = recoverEmail.value;
    const submitButton = recoverForm.querySelector("button[type='submit']");

    try {
      submitButton.disabled = true;
      submitButton.textContent = "Enviando...";
      const result = await window.gestionUserDb.recoverPassword(email);
      recoverStatus.querySelector("p").innerHTML = `${result.message} <span>Revisa tu bandeja de entrada.</span>`;
      recoverStatus.hidden = false;
    } catch (error) {
      recoverStatus.querySelector("p").textContent = error.message;
      recoverStatus.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar enlace de recuperacion";
    }
  });
}

if (resetForm) {
  const newPassword = resetForm.querySelector("#new-password");
  newPassword.addEventListener("input", () => validation.setFieldError(newPassword, ""));
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = new URLSearchParams(window.location.search).get("token");
    const password = newPassword.value;
    const message = validation.passwordError(password);
    validation.setFieldError(newPassword, message);
    if (message) {
      newPassword.focus();
      return;
    }

    const submitButton = resetForm.querySelector("button[type='submit']");
    try {
      submitButton.disabled = true;
      submitButton.textContent = "Guardando...";
      const result = await window.gestionUserDb.resetPassword(token, password);
      resetStatus.querySelector("p").innerHTML = `${result.message} <span>Ya puedes iniciar sesion.</span>`;
      resetStatus.hidden = false;
      resetForm.reset();
    } catch (error) {
      resetStatus.querySelector("p").textContent = error.message;
      resetStatus.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Guardar nueva contrasena";
    }
  });
}
