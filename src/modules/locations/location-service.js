const { sql, connectDb } = require('../../core/config/db');

exports.getAllLokasi = async () => {
  const pool = await connectDb(); // Ambil global pool
  const request = pool.request();

  const query = `
    SELECT IdLokasi, Blok, Enable
    FROM MstLokasi 
    WHERE Enable = 1
    ORDER BY Blok ASC
  `;

  const result = await request.query(query);
  return result.recordset;
};
