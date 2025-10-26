// src/features/auth/auth-service.js
const { sql, poolPromise } = require('../../core/config/db');
const { hashPassword } = require('../../core/utils/crypto-helper');

async function verifyUser(username, password) {
  const pool = await poolPromise;                 // ← ini sekarang valid
  const hashedPassword = hashPassword(password);

  const result = await pool.request()
    .input('username', sql.VarChar, username)
    .input('password', sql.VarChar, hashedPassword)
    .query(`
      SELECT TOP 1 
        IdUsername,
        Username,
        FName,
        LName,
        Status,
        IsEnable
      FROM dbo.MstUsername
      WHERE Username = @username AND Password = @password
    `);

  if (result.recordset.length === 0) return null;
  return result.recordset[0];
}

module.exports = { verifyUser };
