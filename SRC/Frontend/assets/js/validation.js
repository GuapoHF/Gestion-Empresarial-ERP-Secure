(function setupValidation(global) {
  const typoDomains = {
    "gmial.com": "gmail.com",
    "gmai.com": "gmail.com",
    "hotnail.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "yaho.com": "yahoo.com",
  };

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function emailError(value) {
    const email = normalizeEmail(value);
    if (!email || email.length > 180) return "Ingresa un correo electronico valido.";
    const parts = email.split("@");
    if (parts.length !== 2) return "El correo debe incluir un solo signo @.";
    const [localPart, domain] = parts;
    if (!localPart || localPart.length > 64 || localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
      return "Revisa el texto antes del signo @.";
    }
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart)) return "El correo contiene caracteres no permitidos.";
    const labels = domain.split(".");
    const validDomain = labels.length >= 2 && labels.every((label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
    const topLevelDomain = labels.at(-1) || "";
    if (!validDomain || !/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(topLevelDomain)) return "Revisa el dominio del correo electronico.";
    if (["example", "invalid", "localhost", "test"].includes(topLevelDomain)) return "Utiliza un correo real al que puedas acceder.";
    if (typoDomains[domain]) return `Quisiste escribir ${typoDomains[domain]}?`;
    return "";
  }

  function passwordError(value, username = "") {
    const password = String(value || "");
    if (password.length < 8 || password.length > 72) return "Usa entre 8 y 72 caracteres.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Incluye al menos una letra y un numero.";
    if (/^(?:12345678|password|contrasena|qwerty\d*)$/i.test(password)) return "Esta contrasena es demasiado comun.";
    if (username && password.toLowerCase().includes(String(username).toLowerCase())) return "La contrasena no debe contener tu usuario.";
    return "";
  }

  function setFieldError(input, message) {
    if (!input) return;
    const field = input.closest(".field, .config-field") || input.parentElement;
    let messageNode = field?.querySelector(".input-error");
    if (!messageNode && field) {
      messageNode = document.createElement("small");
      messageNode.className = "input-error";
      messageNode.id = `${input.id || input.name}-error`;
      messageNode.setAttribute("role", "alert");
      field.appendChild(messageNode);
    }
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (messageNode) {
      messageNode.textContent = message;
      messageNode.hidden = !message;
      if (message) input.setAttribute("aria-describedby", messageNode.id);
      else input.removeAttribute("aria-describedby");
    }
  }

  global.gestionValidation = { emailError, normalizeEmail, passwordError, setFieldError };
})(window);
