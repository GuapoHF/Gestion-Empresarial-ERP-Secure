# Gestion-Empresarial
# Arquitectura y Estructura del Proyecto

Este proyecto utiliza una **arquitectura modular (Domain-Driven Design / Feature-based)** separada estrictamente entre el cliente y el servidor. Esta organización garantiza que el código sea escalable, fácil de mantener y que múltiples desarrolladores puedan trabajar simultáneamente sin generar conflictos.

---

## Árbol de Directorios

```text
SRC/
├── Backend/                # (O directorio principal 'src/main/java')
│   ├── common/             # Middlewares, utilidades, constantes compartidas
│   ├── config/             # Configuración de base de datos, seguridad, beans
│   └── modules/            # Módulos de negocio (inventario, ventas, nómina, etc.)
│
└── Frontend/               # (O directorio 'src/main/resources/templates')
    ├── assets/             # CSS, imágenes, JavaScript estático
    ├── components/         # Fragmentos de interfaz reutilizables
    ├── config/             # Configuración de rutas visuales
    ├── features/           # Vistas/páginas organizadas por módulo
    ├── hooks/              # Scripts o componentes de soporte para la UI
    └── layout/             # Plantilla base (Sidebar, Header, Footer)

common/
Función: Almacena todos los recursos transversales y compartidos que no pertenecen a un único módulo de negocio.

Uso habitual:

Manejadores globales de errores y excepciones.

Filtros de seguridad, verificación de permisos y tokens de acceso.

Funciones auxiliares genéricas (formateadores de fechas, calculadoras financieras, generadores de reportes).

Constantes globales, códigos de estado y enumeraciones compartidas.

config/
Función: Define los ajustes y parámetros de entorno necesarios para que el servidor pueda inicializarse y conectarse con servicios externos.

Uso habitual:

Parámetros de conexión a la base de datos.

Lectura y mapeo de variables de entorno del sistema.

Ajustes de seguridad, encriptación, CORS y puertos de red.

Credenciales de servicios externos (servidores de correo, pasarelas de pago, almacenamiento en la nube).

modules/
Función: Es el núcleo de negocio del backend. Agrupa el código por áreas funcionales o dominios del sistema.

Uso habitual:

Cada subcarpeta dentro de modules/ representa una entidad de negocio (ej. Inventario, Ventas, Compras, Nómina, Contabilidad).

Dentro de cada módulo se encapsulan sus propios puntos de entrada (endpoints/handlers), su lógica operativa, la interacción con la base de datos y las validaciones de entrada de datos.

2. Directorio Frontend/
Encargado de la interfaz de usuario, la maquetación visual, la experiencia de usuario y la comunicación orientada al cliente.

assets/
Función: Almacena únicamente recursos estáticos necesarios para la presentación visual de la aplicación.

Uso habitual:

Imágenes, logotipos e ilustraciones.

Tipografías y fuentes personalizadas.

Estilos globales, hojas de diseño base y temas visuales.

Íconos y archivos multimedia estáticos.

components/
Función: Agrupa componentes visuales genéricos y agnósticos al negocio, diseñados para reutilizarse en cualquier parte de la aplicación.

Uso habitual:

Botones, campos de texto, desplegables y controles de formulario.

Tablas dinámicas con paginación genérica.

Modales de confirmación, tarjetas (cards) y alertas/notificaciones visuales.

config/
Función: Centraliza la configuración técnica del cliente web y la conexión con el backend.

Uso habitual:

Configuración del cliente HTTP/red (direcciones URL base del servidor, tiempos de espera, encabezados por defecto).

Rutas base de navegación.

Constantes globales de la interfaz gráfica.

features/
Función: Es el núcleo de la interfaz de usuario. Agrupa las pantallas, vistas y flujos organizados por área funcional.

Uso habitual:

Se divide en subcarpetas equivalentes a las áreas de negocio del sistema (ej. Inventario, Ventas, Nómina, Contabilidad).

Cada área contiene sus vistas/páginas específicas, formularios complejos de ese módulo y componentes privados que solo pertenecen a ese flujo.

hooks/
Función: Encapsula la lógica de estado, comportamiento reutilizable y manejo de eventos que debe mantenerse separada de la capa visual.

Uso habitual:

Gestión de formularios reutilizables y sus validaciones.

Lógica para consultar, guardar en caché o sincronizar datos.

Detección de eventos del navegador (cambios de tamaño de pantalla, atajos de teclado, estado de conexión).

layout/
Función: Define el armazón o estructura estática que envuelve las diferentes pantallas de la aplicación.

Uso habitual:

Menú de navegación lateral (Sidebar) o superior (Navbar).

Barra de estado, encabezado de usuario y pie de página (Footer).

Envoltorios de páginas principales para mantener consistencia visual en todo el sistema.

Importante
1. Reutilización vs. Módulos: Si un elemento visual o función sirve en más de 2 áreas distintas, colócalo en components/, common/ o hooks/. Si es exclusivo de un proceso (ej. cálculo de nómina), debe vivir dentro de su respectivo módulo en features/ o modules/.

2. Separación de Responsabilidades: Las carpetas dentro de Frontend/ jamás deben procesar reglas de negocio pesadas o cálculos financieros complejos; estas operaciones deben delegarse siempre al Backend/.

## Ejecutar backend de autenticacion

El login y el registro pueden conectarse al backend JavaScript incluido en `SRC/Backend/server.js`.
Para probarlo localmente ejecuta:
```bash
node SRC/Backend/server.js
```

Luego abre `http://localhost:3000/login.html`. Las cuentas se guardan en `SRC/Backend/database/users.json`; si el archivo no existe, `SRC/Backend/config/db.js` lo crea con el usuario inicial `gabrielh` y solo permite iniciar sesion cuando el usuario y la contrasena coinciden con una cuenta guardada.
