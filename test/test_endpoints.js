/**
 * @file test_endpoints.js
 * @description Suite de pruebas automatizadas para verificar todos los requerimientos técnicos:
 * - Funciones puras e inmutabilidad en validator.js
 * - CRUD completo con códigos HTTP exactos (200, 201, 400, 404, 409)
 * - Restricción UNIQUE en SKU y manejo de conflicto 409
 * - Formato uniforme del contrato JSON de errores
 * - Auditoría de sesión con express-session
 * - Exportación de inventario en JSON y CSV
 * - Emisión en tiempo real vía Socket.io
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { io: Client } = require('socket.io-client');
const assert = require('assert');

// Importar validador puro
const validator = require('../src/utils/validator');

console.log('--- INICIANDO SUITE DE PRUEBAS TÉCNICAS ---\n');

// 1. Verificación de funciones puras e inmutabilidad
console.log('1. Verificando funciones puras e inmutabilidad en validator.js...');
const rawData = { sku: '  LAPTOP-01  ', nombre: '  Laptop Gamer  ', stock: '15', precio: '1299.99' };
const originalClone = { ...rawData };

const sanitized = validator.sanitizeItemInput(rawData);
assert.deepStrictEqual(rawData, originalClone, 'El objeto de entrada no debe ser mutado.');
assert.strictEqual(Object.isFrozen(sanitized), true, 'El objeto sanitizado debe estar congelado.');
assert.strictEqual(sanitized.sku, 'LAPTOP-01', 'El SKU debe ser recortado.');
assert.strictEqual(sanitized.stock, 15, 'El stock debe ser convertido a número entero.');
assert.strictEqual(sanitized.precio, 1299.99, 'El precio debe ser convertido a número real.');

// Intentar mutar sanitized
try {
  sanitized.sku = 'MODIFICADO';
} catch (e) {
  // En strict mode lanza error
}
assert.strictEqual(sanitized.sku, 'LAPTOP-01', 'El objeto congelado no debe permitir mutaciones.');

const validationRes = validator.validateItem(sanitized);
assert.strictEqual(validationRes.isValid, true, 'La validación debe ser exitosa.');
assert.strictEqual(Object.isFrozen(validationRes.errors), true, 'El arreglo de errores debe ser inmutable.');

// Validación de error: stock negativo y precio cero
const invalidValidation = validator.validateItem({ sku: 'A', nombre: 'X', stock: -5, precio: 0 });
assert.strictEqual(invalidValidation.isValid, false);
assert(invalidValidation.errors.length >= 3, 'Debe capturar múltiples errores de validación.');
console.log('✓ Validaciones puras e inmutabilidad aprobadas.\n');

// 2. Iniciar servidor para pruebas de integración
const app = require('../src/app');
const server = http.createServer(app);
const { Server } = require('socket.io');

const socketServer = new Server(server, { cors: { origin: '*' } });
app.set('io', socketServer);

const TEST_PORT = 4567;

server.listen(TEST_PORT, '127.0.0.1', async () => {
  console.log(`2. Servidor de pruebas escuchando en puerto 127.0.0.1:${TEST_PORT}...`);

  let sessionCookie = '';
  const eventsReceived = [];

  // Conectar cliente Socket.io de prueba
  const socketClient = Client(`http://127.0.0.1:${TEST_PORT}`, {
    transports: ['websocket', 'polling'],
    timeout: 3000
  });

  socketClient.on('connect_error', (err) => {
    console.error('Error de conexión socket:', err.message);
  });

  socketClient.on('inventario:cambio', (data) => {
    eventsReceived.push(data);
  });

  await new Promise((resolve) => {
    if (socketClient.connected) return resolve();
    socketClient.once('connect', resolve);
  });
  console.log('✓ Cliente Socket.io de prueba conectado.\n');

  // Función helper para peticiones HTTP
  const request = (method, path, body = null, useCookie = true) => {
    return new Promise((resolve, reject) => {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (useCookie && sessionCookie) {
        headers['Cookie'] = sessionCookie;
      }

      const req = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers
      }, (res) => {
        // Guardar cookie de sesión si viene
        if (res.headers['set-cookie']) {
          const cookieHeader = res.headers['set-cookie'][0];
          sessionCookie = cookieHeader.split(';')[0];
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  };

  try {
    // A. Probar creación POST (201 Created)
    console.log('3. Probando POST /api/items (Creación)...');
    const skuTest = `TEST-${Date.now()}`;
    const createRes = await request('POST', '/api/items', {
      sku: skuTest,
      nombre: 'Monitor 4K OLED',
      stock: 10,
      precio: 799.50
    });

    assert.strictEqual(createRes.status, 201, 'Debe devolver código HTTP 201.');
    assert.strictEqual(createRes.body.status, 'success');
    const createdId = createRes.body.data.id;
    assert(createdId > 0, 'Debe retornar el ID del nuevo producto.');
    console.log(`✓ Producto creado con ID ${createdId} y SKU ${skuTest}.`);

    // B. Probar conflicto UNIQUE SKU (409 Conflict)
    console.log('4. Probando conflicto de SKU duplicado (409 Conflict)...');
    const conflictRes = await request('POST', '/api/items', {
      sku: skuTest,
      nombre: 'Monitor Duplicado',
      stock: 5,
      precio: 600
    });

    assert.strictEqual(conflictRes.status, 409, 'Debe devolver código HTTP 409 Conflict.');
    assert.strictEqual(conflictRes.body.status, 'error');
    assert.strictEqual(conflictRes.body.code, 409);
    assert(Array.isArray(conflictRes.body.details), 'Details debe ser un array.');
    assert(conflictRes.body.timestamp, 'Timestamp debe estar presente.');
    console.log('✓ Captura de conflicto UNIQUE y respuesta 409 uniforme verificada.');

    // C. Probar error de validación (400 Bad Request)
    console.log('5. Probando validación fallida (400 Bad Request)...');
    const badRes = await request('POST', '/api/items', {
      sku: '',
      nombre: '',
      stock: -1,
      precio: -10
    });
    assert.strictEqual(badRes.status, 400, 'Debe devolver código HTTP 400 Bad Request.');
    assert.strictEqual(badRes.body.code, 400);
    assert(badRes.body.details.length >= 4, 'Debe detallar todos los campos fallidos.');
    console.log('✓ Contrato de error 400 uniforme verificado.');

    // D. Probar GET por ID (200 OK y 404 Not Found)
    console.log('6. Probando GET /api/items/:id...');
    const getRes = await request('GET', `/api/items/${createdId}`);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.data.sku, skuTest);

    const notFoundRes = await request('GET', '/api/items/999999');
    assert.strictEqual(notFoundRes.status, 404, 'Debe devolver código HTTP 404.');
    assert.strictEqual(notFoundRes.body.code, 404);
    console.log('✓ GET 200 y 404 verificados correctamente.');

    // E. Probar PUT /api/items/:id (200 OK)
    console.log('7. Probando PUT /api/items/:id (Actualización)...');
    const putRes = await request('PUT', `/api/items/${createdId}`, {
      sku: `${skuTest}-UPDATED`,
      nombre: 'Monitor 4K OLED Pro Max',
      stock: 25,
      precio: 899.99
    });
    assert.strictEqual(putRes.status, 200);
    assert.strictEqual(putRes.body.data.nombre, 'Monitor 4K OLED Pro Max');
    assert.strictEqual(putRes.body.data.stock, 25);
    console.log('✓ PUT 200 verificado correctamente.');

    // F. Probar exportación (GET /api/items/export)
    console.log('8. Probando exportación en JSON y CSV...');
    const exportJson = await request('GET', '/api/items/export?format=json');
    assert.strictEqual(exportJson.status, 200);
    assert(exportJson.headers['content-disposition'].includes('inventario.json'));
    assert(Array.isArray(exportJson.body));

    const exportCsv = await request('GET', '/api/items/export?format=csv');
    assert.strictEqual(exportCsv.status, 200);
    assert(exportCsv.headers['content-disposition'].includes('inventario.csv'));
    assert(typeof exportCsv.body === 'string' && exportCsv.body.includes('id,sku,nombre,stock,precio'));
    console.log('✓ Exportación JSON y CSV verificada.');

    // G. Probar DELETE /api/items/:id (200 OK)
    console.log('9. Probando DELETE /api/items/:id...');
    const deleteRes = await request('DELETE', `/api/items/${createdId}`);
    assert.strictEqual(deleteRes.status, 200);
    console.log('✓ DELETE 200 verificado.');

    // H. Probar auditoría de sesión (GET /api/items/session-audit)
    console.log('10. Probando auditoría de sesión (GET /api/items/session-audit)...');
    const auditRes = await request('GET', '/api/items/session-audit');
    assert.strictEqual(auditRes.status, 200);
    assert.strictEqual(auditRes.body.status, 'success');
    assert(auditRes.body.sessionId, 'SessionId debe existir.');
    assert(auditRes.body.totalActions >= 5, 'Deben registrarse al menos 5 acciones inmutables en la sesión.');
    console.log(`✓ Auditoría de sesión verificada. Acciones registradas: ${auditRes.body.totalActions}`);

    // I. Verificar eventos recibidos en tiempo real por Socket.io
    console.log('11. Verificando eventos de tiempo real en Socket.io...');
    // Esperar unos milisegundos para sincronización
    await new Promise((r) => setTimeout(r, 300));
    const actions = eventsReceived.map(e => e.accion || e.action);
    assert(actions.includes('CREADO') || actions.includes('CREATED'), 'Debe haber emitido evento CREADO.');
    assert(actions.includes('ACTUALIZADO') || actions.includes('UPDATED'), 'Debe haber emitido evento ACTUALIZADO.');
    assert(actions.includes('ELIMINADO') || actions.includes('DELETED'), 'Debe haber emitido evento ELIMINADO.');
    console.log(`✓ Eventos de Socket.io capturados: ${actions.join(', ')}`);

    console.log('\n=============================================');
    console.log('🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE 🎉');
    console.log('=============================================');

    socketClient.disconnect();
    server.close(() => {
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Error en las pruebas:', err);
    socketClient.disconnect();
    server.close(() => {
      process.exit(1);
    });
  }
});
