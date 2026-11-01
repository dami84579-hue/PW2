/**
 * @file validator.js
 * @description Módulo de funciones puras para validación y sanitización de datos de inventario.
 * Sigue los principios de la programación funcional: ausencia de efectos secundarios,
 * inmutabilidad estricta con Object.freeze y sintaxis spread (...).
 */

/**
 * Función pura para recortar cadenas de texto sin mutar el valor original.
 * @param {*} value
 * @returns {*}
 */
const sanitizeString = (value) => {
  return typeof value === 'string' ? value.trim() : value;
};

/**
 * Función pura para sanitizar el payload recibido de un ítem de inventario.
 * Retorna un nuevo objeto inmutable congelado sin mutar el objeto de entrada.
 * @param {Object} payload 
 * @returns {Readonly<Object>}
 */
const sanitizeItemInput = (payload = {}) => {
  const raw = payload && typeof payload === 'object' ? payload : {};
  
  const parsedStock = typeof raw.stock === 'string' && raw.stock.trim() !== '' 
    ? Number(raw.stock) 
    : raw.stock;

  const parsedPrecio = typeof raw.precio === 'string' && raw.precio.trim() !== '' 
    ? Number(raw.precio) 
    : raw.precio;

  const sanitized = {
    ...raw,
    sku: sanitizeString(raw.sku),
    nombre: sanitizeString(raw.nombre),
    stock: parsedStock,
    precio: parsedPrecio
  };

  return Object.freeze(sanitized);
};

/**
 * Validador puro para el campo SKU.
 * @param {*} sku 
 * @returns {string|null} Mensaje de error o null si es válido.
 */
const validateSku = (sku) => {
  if (sku === undefined || sku === null || sku === '') {
    return 'El campo "sku" es obligatorio.';
  }
  if (typeof sku !== 'string') {
    return 'El campo "sku" debe ser una cadena de texto.';
  }
  if (sku.length < 3 || sku.length > 50) {
    return 'El campo "sku" debe tener entre 3 y 50 caracteres.';
  }
  const skuRegex = /^[A-Za-z0-9-_]+$/;
  if (!skuRegex.test(sku)) {
    return 'El campo "sku" solo puede contener letras, números, guiones y guiones bajos.';
  }
  return null;
};

/**
 * Validador puro para el campo Nombre.
 * @param {*} nombre 
 * @returns {string|null}
 */
const validateNombre = (nombre) => {
  if (nombre === undefined || nombre === null || nombre === '') {
    return 'El campo "nombre" es obligatorio.';
  }
  if (typeof nombre !== 'string') {
    return 'El campo "nombre" debe ser una cadena de texto.';
  }
  if (nombre.length < 2 || nombre.length > 100) {
    return 'El campo "nombre" debe tener entre 2 y 100 caracteres.';
  }
  return null;
};

/**
 * Validador puro para el campo Stock (entero >= 0).
 * @param {*} stock 
 * @returns {string|null}
 */
const validateStock = (stock) => {
  if (stock === undefined || stock === null || stock === '') {
    return 'El campo "stock" es obligatorio.';
  }
  if (typeof stock !== 'number' || Number.isNaN(stock) || !Number.isInteger(stock)) {
    return 'El campo "stock" debe ser un número entero.';
  }
  if (stock < 0) {
    return 'El campo "stock" debe ser mayor o igual a 0.';
  }
  return null;
};

/**
 * Validador puro para el campo Precio (número real > 0).
 * @param {*} precio 
 * @returns {string|null}
 */
const validatePrecio = (precio) => {
  if (precio === undefined || precio === null || precio === '') {
    return 'El campo "precio" es obligatorio.';
  }
  if (typeof precio !== 'number' || Number.isNaN(precio)) {
    return 'El campo "precio" debe ser un valor numérico.';
  }
  if (precio <= 0) {
    return 'El campo "precio" debe ser un número estrictamente mayor a 0.';
  }
  return null;
};

/**
 * Validador puro para IDs numéricos de rutas (por ejemplo /:id).
 * @param {*} id 
 * @returns {Readonly<{ isValid: boolean, error: string|null, value: number|null }>}
 */
const validateId = (id) => {
  const numericId = Number(id);
  if (!id || Number.isNaN(numericId) || !Number.isInteger(numericId) || numericId <= 0) {
    return Object.freeze({
      isValid: false,
      error: 'El identificador proporcionado debe ser un número entero positivo.',
      value: null
    });
  }
  return Object.freeze({
    isValid: true,
    error: null,
    value: numericId
  });
};

/**
 * Función pura para validar completamente un ítem de inventario.
 * No genera efectos secundarios ni muta los parámetros recibidos.
 * @param {Object} rawInput 
 * @returns {Readonly<{ isValid: boolean, errors: ReadonlyArray<string>, sanitizedData: Readonly<Object> }>}
 */
const validateItem = (rawInput = {}) => {
  const sanitized = sanitizeItemInput(rawInput);

  const errors = [
    validateSku(sanitized.sku),
    validateNombre(sanitized.nombre),
    validateStock(sanitized.stock),
    validatePrecio(sanitized.precio)
  ].filter((err) => err !== null);

  return Object.freeze({
    isValid: errors.length === 0,
    errors: Object.freeze([...errors]),
    sanitizedData: sanitized
  });
};

module.exports = Object.freeze({
  sanitizeItemInput,
  validateItem,
  validateId,
  validateSku,
  validateNombre,
  validateStock,
  validatePrecio
});

