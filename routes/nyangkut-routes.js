const express = require('express');
const verifyToken = require('../middleware/verifyToken');  // Mengimpor middleware
const moment = require('moment');
const { sql, connectDb } = require('../db');
const router = express.Router();

const formatDate = (date) => {
  return moment(date).format('DD MMM YYYY');
};


// Route untuk mendapatkan Nomor Nyangkut
router.get('/nyangkut-list', verifyToken, async (req, res) => {
  try {
    await connectDb();

    const result = await sql.query('SELECT [NoNyangkut], [Tgl] FROM [dbo].[Nyangkut_h] WHERE [Tgl] > (SELECT MAX(PeriodHarian) FROM [dbo].[MstTutupTransaksiHarian]) ORDER BY [NoNyangkut] DESC');

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ message: 'Tidak Label Yang Nyangkut saat ini' });
    }

    const formattedData = result.recordset.map(item => ({
      NoNyangkut: item.NoNyangkut,
      Tgl: formatDate(item.Tgl)
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// ========================================
// Label Nyangkut (Simplified)
// ========================================
router.get('/label-nyangkut/:nonyangkut', verifyToken, async (req, res) => {
  const { nonyangkut } = req.params;
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const filterBy = req.query.filterBy || null;
  const idlokasi = req.query.idlokasi || null;
  const offset = (page - 1) * pageSize;
  const { username } = req;

  if (page <= 0 || pageSize <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Page and pageSize must be positive numbers.'
    });
  }

  if (!nonyangkut || nonyangkut.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'NoNyangkut parameter is required.'
    });
  }

  let pool;
  try {
    pool = await connectDb();
    const request = new sql.Request(pool);
    request.input('nonyangkut', sql.VarChar, nonyangkut);
    if (idlokasi && idlokasi !== 'all') {
      request.input('idlokasi', sql.VarChar, idlokasi);
    }

    // === QUERY CREATOR FUNCTIONS ===
    function createQuery(tableName, columnName, labelType, tableH) {
      return `
        SELECT d.${columnName} AS CombinedLabel, 
               '${labelType}' AS LabelType, 
               h.IdLokasi AS LabelLocation, 
               ISNULL(h.DateCreate, '1900-01-01') AS DateCreate,
               d.NoNyangkut,
               d.DateLancar
        FROM ${tableName} d
        INNER JOIN ${tableH} h ON d.${columnName} = h.${columnName}
        WHERE d.NoNyangkut = @nonyangkut
        AND d.DateLancar IS NULL
        AND h.DateUsage IS NULL
        ${idlokasi && idlokasi !== 'all' ? "AND h.IdLokasi = @idlokasi" : ""}
      `;
    }

    function createTotalQuery(tableName, columnName, tableH) {
      return `
        SELECT COUNT(*) AS total FROM ${tableName} d
        INNER JOIN ${tableH} h ON d.${columnName} = h.${columnName}
        WHERE d.NoNyangkut = @nonyangkut
        AND d.DateLancar IS NULL
        AND h.DateUsage IS NULL
        ${idlokasi && idlokasi !== 'all' ? "AND h.IdLokasi = @idlokasi" : ""}
      `;
    }

    // === FILTER MAP ===
    const filterMap = {
      'st': { table: 'Nyangkut_ST', column: 'NoST', type: 'Sawn Timber', tableH: 'ST_h' },
      'sanding': { table: 'Nyangkut_Sanding', column: 'NoSanding', type: 'Sanding', tableH: 'Sanding_h' },
      's4s': { table: 'Nyangkut_S4S', column: 'NoS4S', type: 'S4S', tableH: 'S4S_h' },
      'moulding': { table: 'Nyangkut_Moulding', column: 'NoMoulding', type: 'Moulding', tableH: 'Moulding_h' },
      'laminating': { table: 'Nyangkut_Laminating', column: 'NoLaminating', type: 'Laminating', tableH: 'Laminating_h' },
      'fj': { table: 'Nyangkut_FJ', column: 'NoFJ', type: 'Finger Joint', tableH: 'FJ_h' },
      'ccakhir': { table: 'Nyangkut_CCA', column: 'NoCCAkhir', type: 'CC Akhir', tableH: 'CCAkhir_h' },
      'bj': { table: 'Nyangkut_BarangJadi', column: 'NoBJ', type: 'Barang Jadi', tableH: 'BarangJadi_h' },
    };

    let query = '';
    let totalCountQuery = '';

    // === BUILD QUERY ===
    if (filterBy && filterBy !== 'all') {
      const selectedFilter = filterMap[filterBy];
      if (!selectedFilter) {
        return res.status(400).json({
          success: false,
          message: "Invalid filterBy value. Valid values: st, sanding, s4s, moulding, laminating, fj, ccakhir, bj"
        });
      }

      query = `
        ${createQuery(selectedFilter.table, selectedFilter.column, selectedFilter.type, selectedFilter.tableH)}
        ORDER BY DateCreate DESC
        OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
      `;
      totalCountQuery = createTotalQuery(selectedFilter.table, selectedFilter.column, selectedFilter.tableH);
    } else {
      // All filter
      query = `
        SELECT CombinedLabel, LabelType, LabelLocation, DateCreate, NoNyangkut, DateLancar FROM (
          ${createQuery('Nyangkut_ST', 'NoST', 'Sawn Timber', 'ST_h')}
          UNION ALL
          ${createQuery('Nyangkut_Sanding', 'NoSanding', 'Sanding', 'Sanding_h')}
          UNION ALL
          ${createQuery('Nyangkut_S4S', 'NoS4S', 'S4S', 'S4S_h')}
          UNION ALL
          ${createQuery('Nyangkut_Moulding', 'NoMoulding', 'Moulding', 'Moulding_h')}
          UNION ALL
          ${createQuery('Nyangkut_Laminating', 'NoLaminating', 'Laminating', 'Laminating_h')}
          UNION ALL
          ${createQuery('Nyangkut_FJ', 'NoFJ', 'Finger Joint', 'FJ_h')}
          UNION ALL
          ${createQuery('Nyangkut_CCA', 'NoCCAkhir', 'CC Akhir', 'CCAkhir_h')}
          UNION ALL
          ${createQuery('Nyangkut_BarangJadi', 'NoBJ', 'Barang Jadi', 'BarangJadi_h')}
        ) AS subquery
        ORDER BY DateCreate DESC
        OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
      `;

      totalCountQuery = `
        SELECT SUM(total) AS total FROM (
          ${createTotalQuery('Nyangkut_ST', 'NoST', 'ST_h')}
          UNION ALL
          ${createTotalQuery('Nyangkut_Sanding', 'NoSanding', 'Sanding_h')}
          UNION ALL
          ${createTotalQuery('Nyangkut_S4S', 'NoS4S', 'S4S_h')}
          UNION ALL
          ${createTotalQuery('Nyangkut_Moulding', 'NoMoulding', 'Moulding_h')}
          UNION ALL
          ${createTotalQuery('Nyangkut_Laminating', 'NoLaminating', 'Laminating_h')}
          UNION ALL
          ${createTotalQuery('Nyangkut_FJ', 'NoFJ', 'FJ_h')}
          UNION ALL
          ${createTotalQuery('Nyangkut_CCA', 'NoCCAkhir', 'CCAkhir_h')}
          UNION ALL
          ${createTotalQuery('Nyangkut_BarangJadi', 'NoBJ', 'BarangJadi_h')}
        ) AS total_counts;
      `;
    }

    // === EXECUTE QUERY ===
    const [result, totalResult] = await Promise.all([
      request.query(query),
      request.query(totalCountQuery)
    ]);

    const formattedResults = result.recordset.map(record => ({
      ...record,
      DateCreate: formatDate(record.DateCreate),
      DateLancar: formatDate(record.DateLancar)
    }));

    const totalData = totalResult.recordset[0].total || 0;
    const totalPages = Math.ceil(totalData / pageSize);

    res.json({
      success: true,
      message: 'Data label nyangkut berhasil diambil',
      data: {
        noLabelList: formattedResults,
        noLabelFound: formattedResults.length > 0,
        pagination: {
          currentPage: page,
          pageSize,
          totalData,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: {
          filterBy: filterBy || 'all',
          idlokasi: idlokasi || 'all',
          nonyangkut
        }
      }
    });
  } catch (error) {
    console.error('Error fetching label nyangkut:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  } finally {
    if (pool) await pool.close();
  }
});



const checkInOtherTables = async (request, label) => {
  // Menentukan tipe tabel berdasarkan tipe label
  let tablesToCheck = [];
  let columnToSearch = '';

  // Menentukan tabel dan kolom yang relevan berdasarkan kode pertama pada label
  const firstChar = label.charAt(0).toUpperCase();

  if (firstChar === 'E') {
    // Jika 'E', gunakan tabel-tabel untuk S4SProduksiInputST, AdjustmentInputST, BongkarSusunInputST
    tablesToCheck = [
      { tableName: "S4SProduksiInputST", column: "NoProduksi" },
      { tableName: "AdjustmentInputST", column: "NoAdjustment" },
      { tableName: "BongkarSusunInputST", column: "NoBongkarSusun" }
    ];
    columnToSearch = 'NoST'; // Menetapkan kolom pencarian untuk 'E'

  } else if (firstChar === 'R') {
    // Jika 'R', gunakan tabel-tabel untuk S4SProduksiInputS4S, FJProduksiInputS4S, dll.
    tablesToCheck = [
      { tableName: "S4SProduksiInputS4S", column: "NoProduksi" },
      { tableName: "FJProduksiInputS4S", column: "NoProduksi" },
      { tableName: "MouldingProduksiInputS4S", column: "NoProduksi" },
      { tableName: "AdjustmentInputS4S", column: "NoAdjustment" },
      { tableName: "BongkarSusunInputS4S", column: "NoBongkarSusun" }
    ];
    columnToSearch = 'NoS4S'; // Menetapkan kolom pencarian untuk 'R'

  } else if (firstChar === 'S') {
    tablesToCheck = [
      { tableName: "SandingProduksiInputFJ", column: "NoProduksi" },
      { tableName: "S4SProduksiInputFJ", column: "NoProduksi" },
      { tableName: "MouldingProduksiInputFJ", column: "NoProduksi" },
      { tableName: "CCAkhirProduksiInputFJ", column: "NoProduksi" },
      { tableName: "AdjustmentInputFJ", column: "NoAdjustment" },
      { tableName: "BongkarSusunInputFJ", column: "NoBongkarSusun" }
    ];
    columnToSearch = 'NoFJ';

  } else if (firstChar === 'T') {
    tablesToCheck = [
      { tableName: "S4SProduksiInputMoulding", column: "NoProduksi" },
      { tableName: "SandingProduksiInputMoulding", column: "NoProduksi" },
      { tableName: "PackingProduksiInputMoulding", column: "NoProduksi" },
      { tableName: "MouldingProduksiInputMoulding", column: "NoProduksi" },
      { tableName: "LaminatingProduksiInputMoulding", column: "NoProduksi" },
      { tableName: "CCAkhirProduksiInputMoulding", column: "NoProduksi" },
      { tableName: "AdjustmentInputMoulding", column: "NoAdjustment" },
      { tableName: "BongkarSusunInputMoulding", column: "NoBongkarSusun" }
    ];
    columnToSearch = 'NoMoulding';

  } else if (firstChar === 'U') {
    tablesToCheck = [
      { tableName: "MouldingProduksiInputLaminating", column: "NoProduksi" },
      { tableName: "CCAkhirProduksiInputLaminating", column: "NoProduksi" },
      { tableName: "AdjustmentInputLaminating", column: "NoAdjustment" },
      { tableName: "BongkarSusunInputLaminating", column: "NoBongkarSusun" }
    ];
    columnToSearch = 'NoLaminating';

  } else if (firstChar === 'V') {
    tablesToCheck = [
      { tableName: "S4SProduksiInputCCAkhir", column: "NoProduksi" },
      { tableName: "FJProduksiInputCCAkhir", column: "NoProduksi" },
      { tableName: "MouldingProduksiInputCCAkhir", column: "NoProduksi" },
      { tableName: "LaminatingProduksiInputCCAkhir", column: "NoProduksi" },
      { tableName: "SandingProduksiInputCCAkhir", column: "NoProduksi" },
      { tableName: "AdjustmentInputCCAkhir", column: "NoAdjustment" },
      { tableName: "BongkarSusunInputCCAkhir", column: "NoBongkarSusun" }
    ];
    columnToSearch = 'NoCCAkhir';

  } else if (firstChar === 'W') {
    tablesToCheck = [
      { tableName: "LaminatingProduksiInputSanding", column: "NoProduksi" },
      { tableName: "PackingProduksiInputSanding", column: "NoProduksi" },
      { tableName: "AdjustmentInputSanding", column: "NoAdjustment" },
      { tableName: "BongkarSusunInputSanding", column: "NoBongkarSusun" }
    ];
    columnToSearch = 'NoSanding';

  } else if (firstChar === 'I') {
    tablesToCheck = [
      { tableName: "MouldingProduksiInputBarangJadi", column: "NoProduksi" },
      { tableName: "LaminatingProduksiInputBarangJadi", column: "NoProduksi" },
      { tableName: "CCAkhirProduksiInputBarangJadi", column: "NoProduksi" },
      { tableName: "PackingProduksiInputBarangJadi", column: "NoProduksi" },
      { tableName: "BongkarSusunInputBarangJadi", column: "NoBongkarSusun" }
    ];
    columnToSearch = 'NoBJ';

  } else {
    // Jika label bukan 'E' atau 'R', bisa menambahkan logika lain atau handling error
    return { message: 'Invalid label type', status: 400 };
  }

  // Pengecekan tabel sesuai dengan daftar yang sudah ditentukan
  for (let table of tablesToCheck) {
    const checkQuery = `
          SELECT ${table.column}
          FROM ${table.tableName}
          WHERE ${columnToSearch} = @label;
      `;

    const resultCheck = await request.query(checkQuery);

    if (resultCheck.recordset.length > 0) {
      const value = resultCheck.recordset[0][table.column]; // Ambil nilai kolom yang sesuai
      return {
        message: `Label sudah di Proses pada Nomor ${value}!`,
        status: 409,
        value: value // Kembalikan nilai kolom yang ditemukan
      };
    }
  }

  return null; // Tidak ada masalah
};




// Endpoint: POST /label-nyangkut/:nonyangkut
router.post('/label-nyangkut/:nonyangkut', verifyToken, async (req, res) => {
  const { nonyangkut } = req.params;
  const { label } = req.body;
  const { username } = req; 

  if (!label || !nonyangkut) {
    return res.status(400).json({ message: 'Parameter nonyangkut dan label wajib diisi.' });
  }

  const prefix = label.charAt(0).toUpperCase();

  const tableMap = {
    'V': { table: 'Nyangkut_CCA', column: 'NoCCAkhir', tableH: 'CCAkhir_h' },
    'E': { table: 'Nyangkut_ST', column: 'NoST', tableH: 'ST_h' },
    'R': { table: 'Nyangkut_S4S', column: 'NoS4S', tableH: 'S4S_h' },
    'S': { table: 'Nyangkut_FJ', column: 'NoFJ', tableH: 'FJ_h' },
    'T': { table: 'Nyangkut_Moulding', column: 'NoMoulding', tableH: 'Moulding_h' },
    'U': { table: 'Nyangkut_Laminating', column: 'NoLaminating', tableH: 'Laminating_h' },
    'W': { table: 'Nyangkut_Sanding', column: 'NoSanding', tableH: 'Sanding_h' },
    'I': { table: 'Nyangkut_BarangJadi', column: 'NoBJ', tableH: 'BarangJadi_h' },
  };

  const target = tableMap[prefix];
  if (!target) {
    return res.status(400).json({ message: 'Awalan label tidak valid.' });
  }

  let pool;
  try {
    pool = await connectDb();
    const request = new sql.Request(pool);
    request.input('nonyangkut', sql.VarChar, nonyangkut);
    request.input('label', sql.VarChar, label);

    // ✅ Cek apakah label sudah dilancarkan
    const checkLancarQuery = `
      SELECT DateLancar
      FROM ${target.table}
      WHERE ${target.column} = @label
    `;
    const lancarResult = await request.query(checkLancarQuery);
    const existing = lancarResult.recordset[0];

    if (existing && existing.DateLancar !== null) {
      const dateLancar = new Date(existing.DateLancar).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      return res.status(400).json({
        message: `Label ini sudah dilancarkan pada ${dateLancar}!`,
        dateLancar: existing.DateLancar,
      });
    }

    // ✅ Cek apakah DateUsage di table_h sudah terisi
    const checkUsageQuery = `
      SELECT DateUsage 
      FROM ${target.tableH}
      WHERE ${target.column} = @label
    `;
    const usageResult = await request.query(checkUsageQuery);
    const usage = usageResult.recordset[0];

    if (usage && usage.DateUsage !== null) {
      // return res.status(400).json({
      //   message: 'Label ini sudah digunakan (DateUsage sudah terisi). Tidak bisa ditambahkan.',
      // });

      // Pengecekan pada tabel lain
      const otherTableCheck = await checkInOtherTables(request, label);
      if (otherTableCheck) {
        return res.status(otherTableCheck.status).json({ message: otherTableCheck.message });
      }

    }

    // ✅ Cek duplikat di NoNyangkut yang sama
    const checkDuplicateQuery = `
      SELECT COUNT(*) AS count
      FROM ${target.table}
      WHERE ${target.column} = @label AND NoNyangkut = @nonyangkut
    `;
    const duplicateResult = await request.query(checkDuplicateQuery);
    const isDuplicate = duplicateResult.recordset[0].count > 0;

    if (isDuplicate) {
      return res.status(409).json({ message: 'Data duplikat!' });
    }

    // ✅ Simpan data
    const insertQuery = `
      INSERT INTO ${target.table} (NoNyangkut, ${target.column}, DateLancar)
      VALUES (@nonyangkut, @label, NULL);
    `;
    await request.query(insertQuery);

    console.log(`[${new Date().toISOString()}] ${username} scan label nyangkut: ${label}`);

    return res.status(201).json({ message: 'Label berhasil disimpan.' });

  } catch (error) {
    console.error('Error insert label:', error);
    return res.status(500).json({ message: 'Gagal menyimpan data.', error: error.message });
  } finally {
    if (pool) await pool.close();
  }
});



// Endpoint: PUT /label-nyangkut/lancar/:label
router.put('/label-nyangkut/lancar/:label', verifyToken, async (req, res) => {
  const { label } = req.params;
  const { username } = req; 

  if (!label) {
    return res.status(400).json({ message: 'Parameter label wajib diisi.' });
  }

  const prefix = label.charAt(0).toUpperCase();

  const tableMap = {
    'V': { table: 'Nyangkut_CCA', column: 'NoCCAkhir' },
    'E': { table: 'Nyangkut_ST', column: 'NoST' },
    'R': { table: 'Nyangkut_S4S', column: 'NoS4S' },
    'S': { table: 'Nyangkut_FJ', column: 'NoFJ' },
    'T': { table: 'Nyangkut_Moulding', column: 'NoMoulding' },
    'U': { table: 'Nyangkut_Laminating', column: 'NoLaminating' },
    'W': { table: 'Nyangkut_Sanding', column: 'NoSanding' },
    'I': { table: 'Nyangkut_BarangJadi', column: 'NoBJ' },
  };

  const target = tableMap[prefix];
  if (!target) {
    return res.status(400).json({ message: 'Awalan label tidak valid.' });
  }

  let pool;
  try {
    pool = await connectDb();
    const request = new sql.Request(pool);
    request.input('label', sql.VarChar, label);
    request.input('now', sql.DateTime, new Date());

    // ✅ Cek apakah label ada
    const checkQuery = `
      SELECT TOP 1 ${target.column}, DateLancar
      FROM ${target.table}
      WHERE ${target.column} = @label
    `;
    const checkResult = await request.query(checkQuery);
    const existing = checkResult.recordset[0];

    if (!existing) {
      return res.status(404).json({ message: 'Label tidak ditemukan di tabel nyangkut.' });
    }

    if (existing.DateLancar !== null) {
      return res.status(400).json({ message: 'Label ini sudah dilancarkan sebelumnya.' });
    }

    // ✅ Update DateLancar ke tanggal sekarang
    const updateQuery = `
      UPDATE ${target.table}
      SET DateLancar = @now
      WHERE ${target.column} = @label
    `;
    await request.query(updateQuery);

    console.log(`[${new Date().toISOString()}] ${username} scan label lancar: ${label}`);

    return res.status(200).json({ message: 'Label berhasil dilancarkan.' });

  } catch (error) {
    console.error('Error update lancar:', error);
    return res.status(500).json({ message: 'Gagal update DateLancar.', error: error.message });
  } finally {
    if (pool) await pool.close();
  }
});








module.exports = router;