require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDb } = require('./src/core/config/db');
const getLocalIp = require('./src/core/utils/get-local-ip');
const initSocket = require('./src/core/socket/socket');

const port = process.env.PORT || 5002;
const server = http.createServer(app);

// Inisialisasi WebSocket (ws)
initSocket(server);

// Start server
server.listen(port, () => {
  const ip = getLocalIp();
  console.log('✅ Server berjalan:');
  console.log(`   Local:   http://localhost:${port}`);
  console.log(`   Network: http://${ip}:${port}`);
  
  connectDb();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
