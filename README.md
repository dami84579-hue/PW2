# 📦 API REST de Gestión de Inventario en Tiempo Real

API REST robusta, modular y desacoplada para la gestión de inventario, construida desde cero bajo principios de **arquitectura en capas** y **programación funcional** con **Node.js**, **Express**, **SQLite3**, **express-session** y **Socket.io**.

---

## 🏛️ Estructura del Proyecto

```text
├── inventario.db            # Base de datos SQLite local (autogenerada)
├── package.json             # Metadatos, dependencias y scripts de ejecución
├── README.md                # Guía de reproducción paso a paso y ejemplos cURL
├── INFORME_TECNICO.md       # Informe técnico condensado de arquitectura y diseño
├── test/
│   └── test_endpoints.js    # Suite de pruebas automatizadas E2E y unitarias
└── src/
    ├── app.js               # Configuración de Express, middlewares y sesiones
    ├── server.js            # Inicialización de HTTP Server y Socket.io
    ├── config/
    │   └── database.js      # Conexión SQLite3 y funciones parametrizadas
    ├── middlewares/
    │   └── errorHandler.js  # Manejo centralizado y uniforme de errores (400, 404, 409, 500)
    ├── routes/
    │   └── items.routes.js  # Endpoints CRUD, auditoría de sesión y exportación
    ├── utils/
    │   └── validator.js     # Funciones puras e inmutabilidad (Object.freeze, spread)
    └── public/
        └── index.html       # Cliente Web en tiempo real con Socket.io
```

---

## 🚀 Requisitos Previos e Instalación

1. **Node.js** (versión 18 o superior recomendada).
2. **NPM** (incluido con Node.js).

### Pasos de Instalación:

1. Clone o abra la carpeta del proyecto en su terminal:
   ```bash
   cd "deber api"
   ```

2. Instale las dependencias del proyecto:
   ```bash
   npm install
   ```

3. Inicie el servidor:
   ```bash
   npm start
   ```
   El servidor estará disponible en `http://localhost:3000`.

4. Para ejecutar la suite de pruebas automatizadas:
   ```bash
   npm test
   ```

---

## 🌐 Panel Web en Tiempo Real (Socket.io)

Abra en su navegador la URL:
👉 **`http://localhost:3000/`**

La página web se conecta automáticamente al servidor mediante WebSockets (`Socket.io`) y mostrará en vivo cada acción realizada en el inventario (`CREATED`, `UPDATED`, `DELETED`) sin necesidad de recargar la página.

---

## 📡 Guía Completa de Endpoints con `curl`

Para simular una sesión persistente y auditar el historial de acciones mediante `express-session`, se utilizan las banderas `-c cookies.txt` (guardar cookies) y `-b cookies.txt` (enviar cookies guardadas).

### 1. Crear un Producto (`POST /api/items`)
Código HTTP esperado: `201 Created`

```bash
curl -i -X POST http://localhost:3000/api/items \
  -c cookies.txt -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"sku": "MON-4K-01", "nombre": "Monitor LG UltraFine 4K", "stock": 12, "precio": 499.99}'
```

**Respuesta JSON esperada (`201`):**
```json
{
  "estado": "éxito",
  "status": "success",
  "mensaje": "Producto registrado exitosamente en el inventario.",
  "datos": {
    "id": 1,
    "sku": "MON-4K-01",
    "nombre": "Monitor LG UltraFine 4K",
    "stock": 12,
    "precio": 499.99
  }
}
```

---

### 2. Conflicto por SKU Duplicado (`POST /api/items`)
Código HTTP esperado: `409 Conflict` (captura de restricción `UNIQUE` en SQLite).

```bash
curl -i -X POST http://localhost:3000/api/items \
  -c cookies.txt -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"sku": "MON-4K-01", "nombre": "Otro Monitor", "stock": 5, "precio": 300}'
```

**Respuesta JSON de Error (`409`):**
```json
{
  "status": "error",
  "code": 409,
  "message": "Conflicto: Ya existe un producto registrado con el SKU proporcionado.",
  "details": [
    "El campo \"sku\" debe ser único en todo el inventario."
  ],
  "timestamp": "2026-10-31T16:20:00.000Z"
}
```

---

### 3. Error de Validación de Entrada (`POST /api/items`)
Código HTTP esperado: `400 Bad Request` (evaluado con funciones puras en `validator.js`).

```bash
curl -i -X POST http://localhost:3000/api/items \
  -c cookies.txt -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"sku": "", "nombre": "A", "stock": -5, "precio": 0}'
```

**Respuesta JSON de Error (`400`):**
```json
{
  "status": "error",
  "code": 400,
  "message": "Error de validación en los datos del ítem.",
  "details": [
    "El campo \"sku\" es obligatorio.",
    "El campo \"nombre\" debe tener entre 2 y 100 caracteres.",
    "El campo \"stock\" debe ser mayor o igual a 0.",
    "El campo \"precio\" debe ser un número estrictamente mayor a 0."
  ],
  "timestamp": "2026-10-31T16:20:00.000Z"
}
```

---

### 4. Listar Todo el Inventario (`GET /api/items`)
Código HTTP esperado: `200 OK`

```bash
curl -i -X GET http://localhost:3000/api/items \
  -c cookies.txt -b cookies.txt
```

---

### 5. Consultar un Producto por ID (`GET /api/items/:id`)
Código HTTP esperado: `200 OK` (o `404 Not Found` si no existe).

```bash
# Existente (200 OK)
curl -i -X GET http://localhost:3000/api/items/1 \
  -c cookies.txt -b cookies.txt

# Inexistente (404 Not Found)
curl -i -X GET http://localhost:3000/api/items/999 \
  -c cookies.txt -b cookies.txt
```

---

### 6. Actualizar un Producto (`PUT /api/items/:id`)
Código HTTP esperado: `200 OK`

```bash
curl -i -X PUT http://localhost:3000/api/items/1 \
  -c cookies.txt -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"sku": "MON-4K-01-PRO", "nombre": "Monitor LG UltraFine 4K Pro Edition", "stock": 20, "precio": 549.99}'
```

---

### 7. Eliminar un Producto (`DELETE /api/items/:id`)
Código HTTP esperado: `200 OK`

```bash
curl -i -X DELETE http://localhost:3000/api/items/1 \
  -c cookies.txt -b cookies.txt
```

---

### 8. Auditoría de la Sesión Actual (`GET /api/items/session-audit`)
Código HTTP esperado: `200 OK`

Devuelve el identificador de sesión y el histórico inmutable de acciones realizadas en esta sesión:

```bash
curl -i -X GET http://localhost:3000/api/items/session-audit \
  -c cookies.txt -b cookies.txt
```

**Respuesta JSON esperada:**
```json
{
  "estado": "éxito",
  "status": "success",
  "idSesion": "4n9u4...",
  "sessionId": "4n9u4...",
  "totalAcciones": 6,
  "historial": [
    {
      "id": 1,
      "accion": "CREAR_PRODUCTO",
      "detalles": { "id": 1, "sku": "MON-4K-01", "nombre": "Monitor LG UltraFine 4K", "stock": 12, "precio": 499.99 },
      "timestamp": "2026-10-31T16:20:00.000Z"
    },
    {
      "id": 2,
      "accion": "ACTUALIZAR_PRODUCTO",
      "detalles": { ... },
      "timestamp": "2026-10-31T16:21:00.000Z"
    }
  ]
}
```

---

### 9. Exportación y Descarga de Archivos (`GET /api/items/export`)

Permite descargar el inventario completo en formato JSON o CSV:

```bash
# Exportar y descargar como JSON
curl -i -X GET "http://localhost:3000/api/items/export?format=json" \
  -c cookies.txt -b cookies.txt \
  -o inventario_export.json

# Exportar y descargar como CSV
curl -i -X GET "http://localhost:3000/api/items/export?format=csv" \
  -c cookies.txt -b cookies.txt \
  -o inventario_export.csv
```

---

## 🛡️ Principios de Seguridad y Calidad Aplicados

1. **Inyección SQL Mitigada:** Todas las consultas SQL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) emplean parámetros vinculados mediante marcadores de posición (`?`).
2. **Programación Funcional:** Ausencia de efectos colaterales en la capa `validator.js`; los objetos retornados se protegen contra mutaciones accidentales mediante `Object.freeze` y el operador spread (`...`).
3. **Manejo Unificado de Errores:** Middleware global que intercepta errores operativos y técnicos devolviendo un contrato JSON predecible y estandarizado con sellos de tiempo ISO 8601.
4. **Auditoría Inmutable:** Registro de auditoría en memoria de sesión que garantiza un histórico confiable de operaciones por usuario sin alterar referencias en memoria previa.

