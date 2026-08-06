const modules = {
  administrador: {
    title: "Administrador",
    description: "Gestion de usuarios, roles y permisos del sistema.",
    icon: "admin.svg",
  },
  compras: {
    title: "Compras",
    description: "Ordenes de compra, proveedores y seguimiento.",
    icon: "compras.svg",
  },
  ventas: {
    title: "Facturacion / Ventas",
    description: "Emision de facturas, notas de credito y ventas.",
    icon: "ventas.svg",
  },
  inventarios: {
    title: "Inventarios",
    description: "Control de stock, almacenes y movimientos.",
    icon: "inventarios.svg",
  },
  contabilidad: {
    title: "Contabilidad",
    description: "Mayor general, cierres contables y reportes.",
    icon: "contabilidad.svg",
  },
  costos: {
    title: "Costos",
    description: "Analisis de costos, margenes y rentabilidad.",
    icon: "costos.svg",
  },
  actividad: {
    title: "Actividad Reciente",
    description: "Historial general de movimientos del sistema.",
    icon: "dashboard.svg",
  },
};

const params = new URLSearchParams(window.location.search);
const currentKey = params.get("modulo") || "administrador";
const currentModule = modules[currentKey] || modules.administrador;

document.title = `Gestion Empresarial | ${currentModule.title}`;
document.querySelector("#module-title").textContent = currentModule.title;
document.querySelector("#crumb-title").textContent = currentModule.title;
document.querySelector("#module-description").textContent = currentModule.description;
document.querySelector("#module-card-title").textContent = `${currentModule.title} listo`;
document.querySelector("#module-icon").src = `./assets/icons/${currentModule.icon}`;

document.querySelectorAll(".side-nav a").forEach((link) => {
  if (link.dataset.module === currentKey) {
    link.classList.add("active");
  }
});
