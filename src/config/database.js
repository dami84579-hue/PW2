/**
 * @file database.js
 * @description Configuración e inicialización de la base de datos SQLite3 local.
 * Proporciona métodos promisificados que garantizan el uso estricto de consultas parametrizadas.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../inventario.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DB Error] No se pudo conectar a la base de datos SQLite:', err.message);
  } else {
    console.log(`[DB] Conectado exitosamente a SQLite3 en: ${DB_PATH}`);
  }
});

// Inicialización de la tabla `items` con las restricciones requeridas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK(stock >= 0),
      precio REAL NOT NULL CHECK(precio > 0)
    )
  `, (err) => {
    if (err) {
      console.error('[DB Error] Error al crear la tabla items:', err.message);
    } else {
      console.log('[DB] Tabla "items" verificada/creada correctamente con índices e integridad referencial.');
    }
  });
});

/**
 * Ejecuta una consulta SQL de tipo SELECT para múltiples registros.
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<Array>}
 */
const queryAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
};

/**
 * Ejecuta una consulta SQL de tipo SELECT para un único registro.
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<Object|null>}
 */
const queryGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
};

/**
 * Ejecuta una consulta SQL de tipo INSERT, UPDATE o DELETE.
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<{ lastID: number, changes: number }>}
 */
const queryRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
};

module.exports = Object.freeze({
  db,
  queryAll,
  queryGet,
  queryRun
});

