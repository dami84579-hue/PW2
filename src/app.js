/**
 * @file app.js
 * @description Configuración de la aplicación Express, middlewares globales,
 * manejo de sesiones y enrutamiento modular.
 */

const express = require('express');
const path = require('path');
const session = require('express-session');
const itemsRoutes = require('./routes/items.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// Middleware para parseo de JSON y payloads URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesiones con express-session
app.use(session({
  name: 'inventario.sid',
  secret: 'clave-secreta-inventario-rest-api-2026',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: false, // Configurado en false para desarrollo local HTTP
    maxAge: 1000 * 60 * 60 * 24 // 24 horas de vigencia
  }
}));

// Servir la interfaz estática web (cliente Socket.io en GET /)
app.use(express.static(path.join(__dirname, 'public')));

// Enrutador principal de la API REST
app.use('/api/items', itemsRoutes);

// Manejador de rutas no encontradas (404)
app.use(notFoundHandler);

// Middleware global de gestión uniforme de errores
app.use(errorHandler);

module.exports = app;

