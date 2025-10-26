// server.js
require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { poolPromise } = require('./src/core/config/db'); // ⬅️ ganti connectDb -> poolPromise
const getLocalIp = require('./src/core/utils/get-local-ip');
const initSocket = require('./src/core/socket/socket');

const port = process.env.PORT || 5002;

(async () => {
  try {
    // ✅ pastikan DB connect dulu
    await poolPromise;

    const server = http.createServer(app);
    initSocket(server);

    server.listen(port, () => {
      const ip = getLocalIp();
      console.log('✅ Server berjalan:');
      console.log(`   Local:   http://localhost:${port}`);
      console.log(`   Network: http://${ip}:${port}`);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('❌ Gagal inisialisasi (DB belum siap):', err.message);
    process.exit(1);
  }
})();
