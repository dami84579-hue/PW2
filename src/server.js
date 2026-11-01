/**
 * @file server.js
 * @description Punto de entrada principal del servidor HTTP y Socket.io.
 * Inicializa el servidor, enlaza WebSockets y escucha en el puerto designado.
 */

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');

const PORT = process.env.PORT || 3000;

// Creación del servidor HTTP a partir de la app Express
const server = http.createServer(app);

// Inicialización de Socket.io sobre el servidor HTTP
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Guardar instancia de io en la aplicación Express para su acceso en controladores
app.set('io', io);

// Gestión de conexiones de clientes Socket.io
io.on('connection', (socket) => {
  console.log(`[Socket.io] Nuevo cliente conectado: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id} (${reason})`);
  });
});

// Iniciar la escucha del servidor
server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`📡 Monitor WebSocket disponible en: http://localhost:${PORT}/`);
  console.log(`📦 Endpoint API REST: http://localhost:${PORT}/api/items`);
  console.log('====================================================');
});

module.exports = { server, io };

