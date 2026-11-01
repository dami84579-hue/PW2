/**
 * @file errorHandler.js
 * @description Middlewares para manejo uniforme de errores y rutas no encontradas.
 * Garantiza el cumplimiento del contrato JSON estricto en español:
 * { "status": "error", "code": <statusCode>, "message": "<mensaje>", "details": [], "timestamp": "<ISO_DATE>" }
 */

/**
 * Clase para errores operacionales con código HTTP y detalles estructurados.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = Array.isArray(details) ? details : [details];
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware para capturar rutas inexistentes (404).
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Middleware global de manejo de errores.
 */
const errorHandler = (err, req, res, next) => {
  // Detectar errores de restricción UNIQUE en SQLite (código 409 Conflict)
  const isSqliteConstraint = err.code === 'SQLITE_CONSTRAINT' || 
    (typeof err.message === 'string' && (
      err.message.includes('UNIQUE constraint failed') ||
      err.message.includes('CHECK constraint failed')
    ));

  let statusCode = err.statusCode || (isSqliteConstraint ? 409 : 500);
  let message = err.message || 'Error interno del servidor.';
  let details = Array.isArray(err.details) ? [...err.details] : [];

  if (isSqliteConstraint) {
    statusCode = 409;
    if (err.message && err.message.includes('items.sku')) {
      message = 'Conflicto: Ya existe un producto registrado con el SKU proporcionado.';
      details = ['El campo "sku" debe ser único en todo el inventario.'];
    } else if (err.message && err.message.includes('CHECK constraint failed')) {
      statusCode = 400;
      message = 'Error de restricción: Los valores de stock o precio violan las reglas de integridad de la base de datos.';
      details = ['El stock debe ser >= 0 y el precio debe ser > 0.'];
    }
  }

  // Respuesta conforme al contrato estricto, incluyendo campos en español
  const errorResponse = Object.freeze({
    estado: 'error',
    status: 'error',
    codigo: statusCode,
    code: statusCode,
    mensaje: message,
    message,
    detalles: Object.freeze(details),
    details: Object.freeze(details),
    marcaTiempo: new Date().toISOString(),
    timestamp: new Date().toISOString()
  });

  res.status(statusCode).json(errorResponse);
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler
};
