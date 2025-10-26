require('dotenv').config();
const sql = require('mssql');

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_DATABASE,
  options: { encrypt: true, trustServerCertificate: true },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

// 🔴 PENTING: poolPromise diekspor!
const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log('✅ Koneksi DB berhasil');
    return pool;
  })
  .catch(err => {
    console.error('❌ Koneksi DB gagal:', err.message);
    throw err;
  });

process.on('SIGINT', async () => {
  try {
    const pool = await poolPromise;
    await pool.close();
    console.log('🛑 Pool DB ditutup dengan aman');
    process.exit(0);
  } catch (err) {
    console.error('❌ Gagal menutup pool DB:', err.message);
    process.exit(1);
  }
});

module.exports = { sql, poolPromise };  // ⬅️ harus ada ini
