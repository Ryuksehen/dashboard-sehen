# VHO Gaming — Guía de instalación

## Requisitos previos

| Software | Versión mínima | Descarga |
|----------|---------------|---------|
| Node.js  | 18 LTS        | https://nodejs.org |
| MySQL    | 8.0           | https://dev.mysql.com/downloads/mysql/ |

---

## 1. Clonar / copiar el proyecto

Copia la carpeta del proyecto al nuevo equipo. Debe tener esta estructura:

```
Omarjs/
├── index.html
├── index.css
├── index.js
├── estacion.js
├── inventario.js
├── finanzas.js
└── backend/
    ├── package.json
    ├── server.js
    ├── db/
    │   ├── connection.js
    │   └── schema.sql
    ├── middleware/
    │   └── auth.js
    └── routes/
```

---

## 2. Crear la base de datos

Abre MySQL y ejecuta el schema:

```bash
mysql -u root -p < backend/db/schema.sql
```

O desde MySQL Workbench: **File → Open SQL Script** → selecciona `backend/db/schema.sql` → ejecutar.

Si ya tenías una base anterior con datos de pruebas, recomienda hacer instalación limpia:

```sql
DROP DATABASE IF EXISTS VHO_gaming;
```

y luego volver a ejecutar `schema.sql`.

### Importante sobre el schema nuevo en español

El schema actual fue migrado para usar nombres internos en español en tablas y columnas

Ejemplos:
- Tabla `users` ahora es `usuarios`
- En `estaciones`, `status` ahora es `estado` con valores `disponible`, `ocupado`, `mantenimiento`
- En `productos`, `price` ahora es `precio` y `stock` ahora es `existencias`

El backend ya hace el mapeo necesario para que el frontend siga trabajando con el mismo contrato API
No necesitas cambiar llamadas del frontend como `status`, `category`, `price` o `stock`

Si vienes de una base de datos anterior debes recrearla desde cero para evitar choques de columnas

---

## 3. Configurar variables de entorno

Dentro de la carpeta `backend/`, copia el archivo de ejemplo y edítalo:

```bash
cd backend
copy .env.example .env
```

Edita `.env` con los datos de tu MySQL local:

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password_de_mysql
DB_NAME=VHO_gaming
JWT_SECRET=cambia_esto_por_un_secreto_seguro_de_al_menos_32_caracteres
CORS_ORIGIN=http://localhost:3000
AUTH_DISABLED=true
```

Notas:
- `AUTH_DISABLED=true` habilita modo desarrollo (no pide token en frontend).
- Cuando tengas login completo, cambia a `AUTH_DISABLED=false`.

---

## 4. Instalar dependencias de Node.js

```bash
cd backend
npm install
```

Esto instala automáticamente todos los paquetes definidos en `package.json`:

- `express` — servidor web
- `mysql2` — conexión a MySQL
- `bcryptjs` — hash de contraseñas
- `jsonwebtoken` — autenticación JWT
- `dotenv` — variables de entorno
- `cors` — política de orígenes cruzados

---

## 4.1 Requerimientos de Python (requeriments.txt)

Si en tu equipo generaste un archivo `requeriments.txt` con `pip freeze`, estos paquetes significan lo siguiente:

| Paquete | ¿Para qué sirve? |
|---------|------------------|
| `defusedxml==0.7.1` | Ayuda a procesar XML de forma segura, evitando ataques comunes en archivos XML maliciosos. |
| `et_xmlfile==2.0.0` | Librería ligera para escribir XML de forma eficiente; normalmente la usa `openpyxl` internamente. |
| `fonttools==4.62.0` | Herramientas para analizar y manipular fuentes (`.ttf`, `.otf`). |
| `fpdf==1.7.2` | Librería clásica para generar PDFs (facturas, reportes, comprobantes). |
| `fpdf2==2.8.7` | Versión moderna de `fpdf`, con más funciones y mejor mantenimiento. |
| `openpyxl==3.1.5` | Permite leer, crear y editar archivos Excel `.xlsx`. |
| `pillow==12.1.1` | Librería para trabajar con imágenes (redimensionar, recortar, convertir formatos, etc.). |
| `pygame==2.6.1` | Librería para crear juegos y aplicaciones multimedia 2D. |

Notas importantes:
- `fpdf` y `fpdf2` suelen cubrir el mismo objetivo; normalmente se recomienda usar solo una para evitar confusiones.
- Este proyecto principal funciona con Node.js + MySQL. Estos paquetes de Python solo son necesarios si tienes scripts o utilidades en Python que los usen.

---

## 5. Iniciar el servidor

**Modo producción:**
```bash
npm start
```

**Modo desarrollo** (reinicia automáticamente al guardar cambios):
```bash
npm run dev
```

---

## 6. Abrir la aplicación

Abre el navegador en:

```
http://localhost:3000
```

La app ya trabaja contra API REST y MySQL en estos endpoints:

- `/api/estaciones`
- `/api/estaciones/tarifas`
- `/api/inventario`
- `/api/transacciones`
- `/api/finanzas`

No se usa `localStorage` para persistencia de datos de negocio.

Referencia rápida:
- Endpoints actualizados en `ENDPOINTS.md`

---

## Solución de problemas comunes

| Error | Solución |
|-------|----------|
| `ECONNREFUSED` en MySQL | Verifica que el servicio MySQL esté corriendo y que `DB_HOST`/`DB_PORT` sean correctos |
| `ER_ACCESS_DENIED_ERROR` | Revisa `DB_USER` y `DB_PASSWORD` en `.env` |
| `Cannot find module` | Ejecuta `npm install` dentro de la carpeta `backend/` |
| Puerto ocupado | Cambia `PORT` en `.env` a otro valor (ej. `3001`) |
| Errores SQL de columnas no existentes | Reinstala la base con `DROP DATABASE IF EXISTS VHO_gaming;` y vuelve a ejecutar `backend/db/schema.sql` |
