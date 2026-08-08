const firstNameInput = document.querySelector("#firstName");
const lastNameInput = document.querySelector("#lastName");
const secondLastNameInput = document.querySelector("#secondLastName");
const emailInput = document.querySelector("#email");
const companyInput = document.querySelector("#company");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const togglePasswordButton = document.querySelector("#toggle-password");
const signupForm = document.querySelector("#signup-form");
const registerAlert = document.querySelector("#register-alert");

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

function showRegisterAlert(message) {
  if (!registerAlert) {
    return;
  }

  registerAlert.querySelector("span").textContent = message;
  registerAlert.hidden = false;
}

firstNameInput.addEventListener("input", updateGeneratedUsername);
lastNameInput.addEventListener("input", updateGeneratedUsername);

window.gestionUserDb.getStoredUsers();

togglePasswordButton.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePasswordButton.setAttribute("aria-label", isHidden ? "Ocultar contrasena" : "Mostrar contrasena");
});

signupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  registerAlert.hidden = true;

  try {
    window.gestionUserDb.createUser({
      firstName: firstNameInput.value,
      lastName: lastNameInput.value,
      secondLastName: secondLastNameInput.value,
      email: emailInput.value,
      password: passwordInput.value,
      company: companyInput.value,
      username: usernameInput.value,
    });

    sessionStorage.setItem("gestionUser", usernameInput.value);
    window.location.href = signupForm.dataset.redirect || "./login.html";
  } catch (error) {
    showRegisterAlert(error.message);
  }
});

updateGeneratedUsername();
