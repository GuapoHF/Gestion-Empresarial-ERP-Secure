# Gestion Empresarial

Sistema web multiempresa para Vicmar y Grupo Cirsa en Honduras, y Telas Olímpica en México. Incluye registro sujeto a aprobacion, sesiones seguras, operaciones por empresa y documentos contables imprimibles.

## Requisitos

- Node.js 18 o superior.
- MySQL o MariaDB. XAMPP funciona con su configuracion predeterminada.

## Instalacion local

1. Inicia MySQL desde XAMPP.
2. Crea la base ejecutando `SRC/Backend/database/schema.sql` en phpMyAdmin o en el cliente MySQL.
3. Instala y arranca el backend:

```bash
cd SRC/Backend
npm install
npm start
```

4. Abre `http://localhost:3000/index.html`.

El servidor tambien ejecuta migraciones compatibles al iniciar, por lo que conserva y actualiza una base creada por versiones anteriores.

## Configuracion

La conexion predeterminada usa `localhost:3306`, usuario `root`, contrasena vacia y base `textiles_db`. Se puede cambiar con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `PORT`.

En desarrollo, si todavia no existe un administrador global activo, el backend crea automaticamente esta cuenta de pruebas al arrancar:

- Usuario: `administrador`
- Contrasena: `Admin12345678`
- Correo: `administrador@vicmar.hn`

La cuenta permite revisar todas las empresas y secciones, ademas de aprobar las solicitudes de registro. Solo se crea si `NODE_ENV` no es `production` y no reemplaza una cuenta administradora existente.

Para personalizar las credenciales se pueden definir `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_USERNAME`. La contrasena inicial debe tener al menos 12 caracteres, una letra y un numero. En produccion no hay credenciales predeterminadas: estas variables son obligatorias para crear el primer administrador y pueden retirarse despues del primer arranque.

El frontend debe abrirse desde `http://localhost:3000`; abrir los HTML directamente o desde otro servidor impide que las solicitudes lleguen a `/api`.

Para recuperacion por correo se aceptan `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` y `SMTP_STARTTLS`. Sin SMTP, el enlace de recuperacion se muestra en la consola local.

## Flujo multiempresa

- El registro exige empresa, area solicitada, correo valido, usuario unico y contrasena de al menos ocho caracteres con letras y numeros.
- La solicitud queda pendiente hasta que el administrador global la aprueba o rechaza.
- Los usuarios aprobados solo consultan y modifican los datos de su empresa.
- Cada rol solo puede abrir y modificar sus modulos autorizados; el servidor vuelve a comprobar el permiso en cada solicitud.
- El administrador puede filtrar solicitudes y reportes por cualquiera de las tres empresas.
- El administrador puede registrar, editar y eliminar empleados con confirmacion explicita. Cada usuario puede eliminar su propia cuenta verificando su contrasena.
- Vicmar y Grupo Cirsa operan con HNL, RTN, ISV, SAR, IHSS y RAP; Telas Olímpica opera con MXN, RFC, IVA, SAT, IMSS, INFONAVIT y FONACOT.
- Las contrasenas se almacenan con `scrypt` y las sesiones expiran automaticamente.

## Contabilidad

Desde `Contabilidad > Estados Financieros` se generan Estado de resultados, Balance general, Balanza de comprobacion, Catalogo de percepciones y deducciones, Ventas y utilidad y Factura de compra. Los documentos extensos se paginan automaticamente y todos pueden imprimirse como PDF o exportarse a CSV.

## Estructura principal

```text
SRC/
|-- Backend/
|   |-- config/       Conexion, correo, autenticacion y migraciones
|   |-- database/     Esquema MySQL
|   |-- modules/      Datos operativos y reportes contables
|   `-- server.js     API y servidor del frontend
`-- Frontend/
    |-- assets/       Estilos, iconos y controladores
    |-- modulo.html   Vistas operativas compartidas
    `-- reportes-contables.html
```
