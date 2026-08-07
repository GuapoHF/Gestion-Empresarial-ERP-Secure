const CONFIG_STORAGE_KEY = "textiles-gh-general-config";

const configForm = document.querySelector("#general-config-form");
const saveButton = document.querySelector("#config-save");
const statusMessage = document.querySelector("#config-status");
const logoInput = document.querySelector("#company-logo-input");
const logoTrigger = document.querySelector("#logo-trigger");
const logoPreview = document.querySelector("#company-logo-preview");
const logoLetter = document.querySelector("#company-logo-letter");
const logoError = document.querySelector("#logo-error");
const dateInput = document.querySelector("#billing-deadline");
const dateTrigger = document.querySelector("#date-trigger");

let logoData = "";

function setLogoPreview(source) {
  logoData = source || "";
  logoPreview.src = logoData;
  logoPreview.hidden = !logoData;
  logoLetter.hidden = Boolean(logoData);
}

function readSavedConfiguration() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY));
    if (!saved) return;

    Object.entries(saved.fields || {}).forEach(([name, value]) => {
      const field = configForm.elements.namedItem(name);
      if (field) field.value = value;
    });
    setLogoPreview(saved.logo);
  } catch (error) {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  }
}

function collectFields() {
  return Object.fromEntries(new FormData(configForm).entries());
}

logoTrigger.addEventListener("click", () => logoInput.click());

logoInput.addEventListener("change", () => {
  const [file] = logoInput.files;
  logoError.hidden = true;
  if (!file) return;

  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) {
    logoError.textContent = "Selecciona una imagen PNG o JPG de hasta 1 MB.";
    logoError.hidden = false;
    logoInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => setLogoPreview(reader.result));
  reader.readAsDataURL(file);
});

dateTrigger.addEventListener("click", () => {
  if (typeof dateInput.showPicker === "function") {
    dateInput.showPicker();
  } else {
    dateInput.focus();
  }
});

configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!configForm.reportValidity()) return;

  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({
      fields: collectFields(),
      logo: logoData,
    }));
    saveButton.textContent = "Cambios Guardados";
    saveButton.classList.add("saved");
    statusMessage.textContent = "La configuracion se guardo correctamente en este dispositivo.";

    window.setTimeout(() => {
      saveButton.textContent = "Guardar Cambios";
      saveButton.classList.remove("saved");
    }, 1800);
  } catch (error) {
    statusMessage.textContent = "No fue posible guardar los cambios en este dispositivo.";
  }
});

readSavedConfiguration();
