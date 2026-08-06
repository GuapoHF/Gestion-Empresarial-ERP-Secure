const passwordInput = document.querySelector("#password");
const togglePasswordButton = document.querySelector("#toggle-password");
const loginForm = document.querySelector("#login-form");
const recoverForm = document.querySelector("#recover-form");
const recoverStatus = document.querySelector("#recover-status");
const usernameInput = document.querySelector("#username");

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
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.href = "./dashboard.html";
  });
}

if (recoverForm) {
  recoverForm.addEventListener("submit", (event) => {
    event.preventDefault();
    recoverStatus.hidden = false;
  });
}
