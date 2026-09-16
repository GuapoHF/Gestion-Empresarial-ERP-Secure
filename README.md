# Gestión Empresarial

Sistema web multiempresa para Vicmar, Grupo Cirsa y Telas Olímpica. El backend Node.js sirve el frontend y guarda autenticación, empleados, operaciones y reportes en **Supabase PostgreSQL**.

## Requisitos

- Node.js 18 o superior.
- Un proyecto de Supabase.
- La contraseña de la base de datos del proyecto (no la clave `anon`).

## Conectar Supabase paso a paso

### 1. Crear el proyecto

1. Inicia sesión en [Supabase](https://supabase.com/dashboard) y selecciona **New project**.
2. Elige la organización, nombre y región más cercana al servidor donde desplegarás la API.
3. Define una contraseña robusta para PostgreSQL y guárdala en un gestor de contraseñas.
4. Espera a que el proyecto termine de aprovisionarse.

> Esta aplicación conserva su autenticación propia (usuarios aprobados, sesiones y permisos). No requiere activar Supabase Auth.

### 2. Crear las tablas con SQL

1. En el panel del proyecto abre **SQL Editor** y pulsa **New query**.
2. Copia **todo** el contenido de [`SRC/Backend/database/schema.sql`](SRC/Backend/database/schema.sql).
3. Pulsa **Run**. El script es idempotente: usa `IF NOT EXISTS` y `ON CONFLICT`, por lo que se puede volver a ejecutar.
4. Abre **Table Editor** y comprueba que existan, entre otras, `companies`, `users`, `auth_sessions`, `employees` y `business_datasets`.
5. En `companies` deben aparecer Vicmar, Telas Olímpica y Grupo Cirsa.

El script crea tablas, restricciones, índices y las tres empresas iniciales. Las migraciones defensivas del backend también crean cualquier tabla faltante al arrancar.

### 3. Obtener la URI correcta

1. Ve a **Project Settings > Database** y localiza **Connection string**.
2. Selecciona formato **URI** y copia la cadena.
3. Sustituye el marcador de contraseña por la contraseña de PostgreSQL.

Para desarrollo local o un servidor con IPv6 se puede usar la conexión directa (puerto `5432`). Si la red solo soporta IPv4 o el despliegue es serverless, usa **Transaction pooler** (normalmente puerto `6543`). En el pooler el usuario suele incluir la referencia del proyecto, por ejemplo `postgres.PROJECT_REF`.

Si la contraseña contiene `@`, `:`, `/`, `#`, `%` u otros caracteres reservados, codifícala para URL. Por ejemplo, en Node:

```bash
node -p "encodeURIComponent('TU CONTRASEÑA')"
```

### 4. Configurar las variables

Desde la raíz del repositorio:

```bash
cp SRC/Backend/.env.example SRC/Backend/.env
```

Edita `SRC/Backend/.env`:

```dotenv
SUPABASE_DB_URL=postgresql://postgres.PROJECT_REF:CONTRASENA_CODIFICADA@aws-0-REGION.pooler.supabase.com:6543/postgres
DB_SSL=true
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=15000
PORT=3000
NODE_ENV=development
```

- `SUPABASE_DB_URL` es la URI PostgreSQL del paso anterior. También se acepta `DATABASE_URL`.
- `DB_SSL=true` es lo recomendado para Supabase.
- `DB_POOL_MAX` limita las conexiones simultáneas del proceso.
- `DB_CONNECTION_TIMEOUT_MS` controla cuánto espera el backend por PostgreSQL antes de mostrar un diagnóstico (15 segundos por defecto).
- `.env` está ignorado por Git. **Nunca** pongas la URI, la contraseña de PostgreSQL ni una `service_role` en el frontend o en un commit.

En producción configura estas variables en el panel del proveedor de hosting, en lugar de subir `.env`. Para crear el primer administrador define temporalmente:

```dotenv
NODE_ENV=production
BOOTSTRAP_ADMIN_EMAIL=admin@tu-dominio.com
BOOTSTRAP_ADMIN_USERNAME=administrador
BOOTSTRAP_ADMIN_PASSWORD=una-clave-segura-123
APP_ORIGIN=https://tu-dominio.com
```

La contraseña debe tener de 12 a 72 caracteres, al menos una letra y un número. Arranca una vez, verifica la cuenta y retira las tres variables `BOOTSTRAP_ADMIN_*` del entorno.

### 5. Instalar y arrancar

```bash
cd SRC/Backend
npm install
npm start
```

Abre `http://localhost:3000`. No abras los HTML mediante `file://` ni desde otro servidor: el frontend consume `/api` en el mismo origen.

En desarrollo, si no existe un administrador activo, el backend crea la cuenta de demostración `administrador` / `Admin12345678`. No se crea automáticamente en producción.

### 6. Verificar la conexión

Con el servidor activo ejecuta:

```bash
curl http://localhost:3000/api/companies
```

Debe responder JSON con las tres empresas. El endpoint `/api/health` solo comprueba el proceso; `/api/companies` también obliga a consultar PostgreSQL y por eso es la prueba real de conexión.

Si falla:

- `Falta SUPABASE_DB_URL`: confirma que el archivo se llama exactamente `SRC/Backend/.env`.
- `password authentication failed`: revisa la contraseña, el usuario del pooler y la codificación URL.
- `getaddrinfo` o timeout: en Supabase abre **Connect > Connection string**, selecciona **Transaction pooler** (puerto `6543`) y reemplaza toda la URI anterior. Esta conexión funciona en redes IPv4; revisa además que el proyecto no esté pausado y que el host y la región no sean marcadores del ejemplo.
- `relation ... does not exist`: vuelve a ejecutar `schema.sql` en SQL Editor y confirma que usaste el proyecto correcto.
- `too many connections`: usa el pooler y reduce `DB_POOL_MAX`.

## Correo de recuperación

Se aceptan `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` y `SMTP_STARTTLS`. Sin SMTP, el enlace de recuperación se muestra en la consola local.

## Seguridad y arquitectura

- El navegador solo llama al backend Node.js; la URI de PostgreSQL permanece en el servidor.
- Las contraseñas se almacenan con `scrypt` y las sesiones expiran automáticamente.
- Los permisos multiempresa y por módulo se vuelven a comprobar en cada solicitud.
- No es necesario desactivar RLS para el cliente porque este proyecto no consulta tablas directamente con `supabase-js`. Si después se agrega acceso directo desde el navegador, deben habilitarse RLS y políticas específicas antes de exponer cualquier tabla.
- Rota inmediatamente la contraseña de la base si una URI real se publica por accidente.

## Estructura principal

```text
SRC/
|-- Backend/
|   |-- config/       Conexión PostgreSQL, correo, autenticación y migraciones
|   |-- database/     Esquema PostgreSQL para Supabase
|   |-- modules/      Datos operativos y reportes contables
|   `-- server.js     API y servidor del frontend
`-- Frontend/
    |-- assets/       Estilos, iconos y controladores
    |-- modulo.html   Vistas operativas compartidas
    `-- reportes-contables.html
```
