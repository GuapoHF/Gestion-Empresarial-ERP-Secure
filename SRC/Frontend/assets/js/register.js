const firstNameInput = document.querySelector("#firstName");
const lastNameInput = document.querySelector("#lastName");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const togglePasswordButton = document.querySelector("#toggle-password");
const signupForm = document.querySelector("#signup-form");

function normalizeUsernamePart(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase();
}

function updateGeneratedUsername() {
  const firstName = normalizeUsernamePart(firstNameInput.value);
  const lastNameInitial = normalizeUsernamePart(lastNameInput.value).charAt(0);
  usernameInput.value = `${firstName}${lastNameInitial}`;
}

firstNameInput.addEventListener("input", updateGeneratedUsername);
lastNameInput.addEventListener("input", updateGeneratedUsername);

togglePasswordButton.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePasswordButton.setAttribute("aria-label", isHidden ? "Ocultar contrasena" : "Mostrar contrasena");
});

signupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sessionStorage.setItem("gestionUser", usernameInput.value);
  window.location.href = signupForm.dataset.redirect || "./login.html";
});

updateGeneratedUsername();
