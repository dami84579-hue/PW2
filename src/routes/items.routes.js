/**
 * @file items.routes.js
 * @description Rutas y controladores para la gestión del inventario.
 * Implementa el CRUD completo, auditoría de sesiones y exportación de datos en español.
 */

const express = require('express');
const router = express.Router();
const { queryAll, queryGet, queryRun } = require('../config/database');
const { validateItem, validateId } = require('../utils/validator');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Función pura auxiliar para registrar acciones en la sesión sin mutación.
 * @param {Object} req 
 * @param {string} accion 
 * @param {Object} detalles 
 */
const recordSessionAction = (req, accion, detalles = {}) => {
  if (!req.session) return;
  const currentLogs = Array.isArray(req.session.logs) ? req.session.logs : [];
  const logEntry = Object.freeze({
    id: currentLogs.length + 1,
    accion,
    action: accion,
    detalles: Object.freeze({ ...detalles }),
    payload: Object.freeze({ ...detalles }),
    timestamp: new Date().toISOString()
  });
  // Creación inmutable del nuevo arreglo de logs
  req.session.logs = Object.freeze([...currentLogs, logEntry]);
};

/**
 * Función auxiliar para emitir eventos de Socket.io si la instancia está configurada.
 * @param {Object} req 
 * @param {string} accion 
 * @param {Object} item 
 */
const emitInventoryChange = (req, accion, item) => {
  const io = req.app.get('io');
  if (io) {
    io.emit('inventario:cambio', Object.freeze({
      accion,
      action: accion, // Mantiene compatibilidad con clientes existentes
      item: Object.freeze({ ...item }),
      timestamp: new Date().toISOString()
    }));
  }
};

// ==========================================
// 1. ENDPOINTS ESPECIALES (Audit y Export)
// ==========================================

/**
 * GET /api/items/session-audit
 * Devuelve el identificador de sesión y el historial de acciones registrado de forma inmutable.
 */
router.get('/session-audit', (req, res) => {
  const logs = Array.isArray(req.session?.logs) ? req.session.logs : [];
  res.status(200).json(Object.freeze({
    estado: 'éxito',
    status: 'success',
    idSesion: req.sessionID || 'sin-sesion-detectada',
    sessionId: req.sessionID || 'no-session-detected',
    totalAcciones: logs.length,
    totalActions: logs.length,
    historial: logs,
    logs
  }));
});

/**
 * GET /api/items/export
 * Genera y descarga un archivo .json o .csv con el inventario actual.
 */
router.get('/export', async (req, res, next) => {
  try {
    const items = await queryAll('SELECT id, sku, nombre, stock, precio FROM items ORDER BY id ASC');
    const format = (req.query.format || 'json').toLowerCase();

    recordSessionAction(req, 'EXPORTAR_INVENTARIO', { formato: format, totalProductos: items.length });

    if (format === 'csv') {
      const headers = 'id,sku,nombre,stock,precio\n';
      const rows = items
        .map(item => `${item.id},"${item.sku.replace(/"/g, '""')}","${item.nombre.replace(/"/g, '""')}",${item.stock},${item.precio}`)
        .join('\n');
      const csvContent = headers + rows;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="inventario.csv"');
      return res.status(200).send(csvContent);
    }

    // Por defecto exporta en formato JSON estructurado
    const jsonContent = JSON.stringify(items, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventario.json"');
    return res.status(200).send(jsonContent);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 2. CRUD COMPLETO (/api/items)
// ==========================================

/**
 * GET /api/items
 * Obtiene la lista completa de productos del inventario.
 */
router.get('/', async (req, res, next) => {
  try {
    const items = await queryAll('SELECT id, sku, nombre, stock, precio FROM items ORDER BY id ASC');
    
    recordSessionAction(req, 'LISTAR_PRODUCTOS', { total: items.length });

    res.status(200).json(Object.freeze({
      estado: 'éxito',
      status: 'success',
      total: items.length,
      count: items.length,
      datos: items,
      data: items
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/items/:id
 * Obtiene un producto por su ID primario.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const idValidation = validateId(req.params.id);
    if (!idValidation.isValid) {
      throw new AppError(idValidation.error, 400);
    }

    const item = await queryGet('SELECT id, sku, nombre, stock, precio FROM items WHERE id = ?', [idValidation.value]);
    if (!item) {
      throw new AppError(`Producto con ID ${idValidation.value} no encontrado en el inventario.`, 404);
    }

    recordSessionAction(req, 'CONSULTAR_PRODUCTO_POR_ID', { idProducto: item.id, sku: item.sku });

    res.status(200).json(Object.freeze({
      estado: 'éxito',
      status: 'success',
      datos: item,
      data: item
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/items
 * Registra un nuevo producto en el inventario.
 */
router.post('/', async (req, res, next) => {
  try {
    const validation = validateItem(req.body);
    if (!validation.isValid) {
      throw new AppError('Error de validación en los datos del producto.', 400, validation.errors);
    }

    const { sku, nombre, stock, precio } = validation.sanitizedData;

    // Inserción parametrizada contra inyección SQL
    const insertResult = await queryRun(
      'INSERT INTO items (sku, nombre, stock, precio) VALUES (?, ?, ?, ?)',
      [sku, nombre, stock, precio]
    );

    const createdItem = await queryGet(
      'SELECT id, sku, nombre, stock, precio FROM items WHERE id = ?',
      [insertResult.lastID]
    );

    // Registro inmutable de sesión
    recordSessionAction(req, 'CREAR_PRODUCTO', createdItem);

    // Emisión en tiempo real vía Socket.io (notifica en español)
    emitInventoryChange(req, 'CREADO', createdItem);

    res.status(201).json(Object.freeze({
      estado: 'éxito',
      status: 'success',
      mensaje: 'Producto registrado exitosamente en el inventario.',
      message: 'Producto registrado exitosamente en el inventario.',
      datos: createdItem,
      data: createdItem
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/items/:id
 * Actualiza completamente los datos de un producto existente.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const idValidation = validateId(req.params.id);
    if (!idValidation.isValid) {
      throw new AppError(idValidation.error, 400);
    }

    const existingItem = await queryGet('SELECT id, sku, nombre, stock, precio FROM items WHERE id = ?', [idValidation.value]);
    if (!existingItem) {
      throw new AppError(`Producto con ID ${idValidation.value} no encontrado para actualizar.`, 404);
    }

    const validation = validateItem(req.body);
    if (!validation.isValid) {
      throw new AppError('Error de validación en los datos a actualizar.', 400, validation.errors);
    }

    const { sku, nombre, stock, precio } = validation.sanitizedData;

    // Actualización parametrizada
    await queryRun(
      'UPDATE items SET sku = ?, nombre = ?, stock = ?, precio = ? WHERE id = ?',
      [sku, nombre, stock, precio, idValidation.value]
    );

    const updatedItem = await queryGet(
      'SELECT id, sku, nombre, stock, precio FROM items WHERE id = ?',
      [idValidation.value]
    );

    // Registro inmutable de sesión
    recordSessionAction(req, 'ACTUALIZAR_PRODUCTO', {
      anterior: existingItem,
      actualizado: updatedItem
    });

    // Emisión en tiempo real vía Socket.io
    emitInventoryChange(req, 'ACTUALIZADO', updatedItem);

    res.status(200).json(Object.freeze({
      estado: 'éxito',
      status: 'success',
      mensaje: 'Producto actualizado exitosamente en el inventario.',
      message: 'Producto actualizado exitosamente en el inventario.',
      datos: updatedItem,
      data: updatedItem
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/items/:id
 * Elimina un producto del inventario.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const idValidation = validateId(req.params.id);
    if (!idValidation.isValid) {
      throw new AppError(idValidation.error, 400);
    }

    const existingItem = await queryGet('SELECT id, sku, nombre, stock, precio FROM items WHERE id = ?', [idValidation.value]);
    if (!existingItem) {
      throw new AppError(`Producto con ID ${idValidation.value} no encontrado para eliminar.`, 404);
    }

    // Eliminación parametrizada
    await queryRun('DELETE FROM items WHERE id = ?', [idValidation.value]);

    // Registro inmutable de sesión
    recordSessionAction(req, 'ELIMINAR_PRODUCTO', existingItem);

    // Emisión en tiempo real vía Socket.io
    emitInventoryChange(req, 'ELIMINADO', existingItem);

    res.status(200).json(Object.freeze({
      estado: 'éxito',
      status: 'success',
      mensaje: 'Producto eliminado exitosamente del inventario.',
      message: 'Producto eliminado exitosamente del inventario.',
      datos: existingItem,
      data: existingItem
    }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
