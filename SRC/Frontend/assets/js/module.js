const modules = {
  administrador: {
    title: "Administrador",
    description: "Gestion de empleados, roles y catalogos textiles.",
    icon: "admin.svg",
  },
  compras: {
    title: "Compras",
    description: "Compras de telas, proveedores y seguimiento.",
    icon: "compras.svg",
  },
  ventas: {
    title: "Facturacion / Ventas",
    description: "Facturacion de telas, pedidos y ventas.",
    icon: "ventas.svg",
  },
  inventarios: {
    title: "Inventarios",
    description: "Control de rollos, metros, colores y movimientos.",
    icon: "inventarios.svg",
  },
  contabilidad: {
    title: "Contabilidad",
    description: "Mayor general, cierres contables y reportes.",
    icon: "contabilidad.svg",
  },
  costos: {
    title: "Costos",
    description: "Analisis de costos por tela, margen y rentabilidad.",
    icon: "costos.svg",
  },
  actividad: {
    title: "Actividad Reciente",
    description: "Historial general de movimientos del sistema textil.",
    icon: "dashboard.svg",
  },
  configuracion: {
    title: "Configuracion General",
    description: "Parametros operativos para sucursales, inventario y ventas de telas.",
    icon: "admin.svg",
  },
  reportes: {
    title: "Reportes Globales",
    description: "Indicadores de ventas, compras, inventario y margen por tela.",
    icon: "costos.svg",
  },
  ayuda: {
    title: "Ayuda",
    description: "Guia de uso para los flujos principales de Textiles GH.",
    icon: "help.svg",
  },
};

const params = new URLSearchParams(window.location.search);
const currentKey = params.get("modulo") || "administrador";

if (currentKey === "configuracion") {
  window.location.replace("./configuracion.html");
}

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
