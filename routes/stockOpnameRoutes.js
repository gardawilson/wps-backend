const express = require('express');
const verifyToken = require('../middleware/verifyToken');  // Mengimpor middleware
const moment = require('moment');
const { sql, connectDb } = require('../db');
const router = express.Router();

const formatDate = (date) => {
  return moment(date).format('DD MMM YYYY');
};



// Route untuk mendapatkan Nomor Stock Opname
router.get('/no-stock-opname', verifyToken, async (req, res) => {
  try {
    await connectDb();

    const result = await sql.query('SELECT NoSO, Tgl FROM StockOpname_h ORDER BY Tgl DESC');

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    const formattedData = result.recordset.map(item => ({
      NoSO: item.NoSO,
      Tgl: formatDate(item.Tgl)
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



// Route untuk mendapatkan data Label berdasarkan No Stock Opname
router.get('/no-stock-opname/:noso', async (req, res) => {
    const { noso } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const filterBy = req.query.filterBy || null;  // Jika tidak ada, set null
    const idlokasi = req.query.idlokasi || null;  // Bisa juga kosong
    const offset = (page - 1) * pageSize;

    console.log("🔍 FilterBy:", filterBy, "| IdLokasi:", idlokasi);

    if (page <= 0 || pageSize <= 0) {
        return res.status(400).json({ message: 'Page and pageSize must be positive numbers.' });
    }

    let pool;
    try {
        pool = await connectDb();
        const request = new sql.Request(pool);
        request.input('noso', sql.VarChar, noso);
        if (idlokasi) request.input('idlokasi', sql.VarChar, idlokasi);

        // Ambil data lokasi
        const mstLokasiResult = await request.query('SELECT IdLokasi, Blok FROM MstLokasi WHERE Enable = 1');

        if (!mstLokasiResult.recordset || mstLokasiResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Data MstLokasi tidak ditemukan' });
        }

        let query = "";
        let totalCountQuery = "";

        function createQuery(tableName, columnName, labelType, headerTable) {

            return `
                SELECT d.${columnName} AS CombinedLabel, '${labelType}' AS LabelType, h.IdLokasi AS LabelLocation
                FROM ${tableName} d
                LEFT JOIN ${headerTable} h ON d.${columnName} = h.${columnName}
                WHERE d.NoSO = @noso
                ${idlokasi && idlokasi !== 'all' ? "AND h.IdLokasi = @idlokasi" : ""}
            `;
        }

        function createTotalQuery(tableName, headerTable, columnName) {

            return `
                SELECT COUNT(*) AS total FROM ${tableName} d
                LEFT JOIN ${headerTable} h ON d.${columnName} = h.${columnName}
                WHERE d.NoSO = @noso
                ${idlokasi && idlokasi !== 'all' ? "AND h.IdLokasi = @idlokasi" : ""}
            `;
        }

        if (filterBy && filterBy !== 'all') {
            const filterMap = {
                'st': { table: 'StockOpname_Hasil_d_ST', column: 'NoST', type: 'Sawn Timber', header: 'ST_h' },
                'sanding': { table: 'StockOpname_Hasil_d_Sanding', column: 'NoSanding', type: 'Sanding', header: 'Sanding_h' },
                's4s': { table: 'StockOpname_Hasil_d_S4S', column: 'NoS4S', type: 'S4S', header: 'S4S_h' },
                'moulding': { table: 'StockOpname_Hasil_d_Moulding', column: 'NoMoulding', type: 'Moulding', header: 'Moulding_h' },
                'laminating': { table: 'StockOpname_Hasil_d_Laminating', column: 'NoLaminating', type: 'Laminating', header: 'Laminating_h' },
                'fj': { table: 'StockOpname_Hasil_d_FJ', column: 'NoFJ', type: 'Finger Joint', header: 'FJ_h' },
                'ccakhir': { table: 'StockOpname_Hasil_d_CCAkhir', column: 'NoCCAkhir', type: 'CC Akhir', header: 'CCAkhir_h' },
                'bj': { table: 'StockOpname_Hasil_d_BJ', column: 'NoBJ', type: 'Barang Jadi', header: 'BarangJadi_h' },
            };

            const selectedFilter = filterMap[filterBy];
            if (!selectedFilter) {
                return res.status(400).json({ message: "Invalid filterBy value" });
            }

            query = `
                ${createQuery(selectedFilter.table, selectedFilter.column, selectedFilter.type, selectedFilter.header)}
                ORDER BY CombinedLabel
                OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
            `;
            totalCountQuery = createTotalQuery(selectedFilter.table, selectedFilter.header, selectedFilter.column);
        } else {

            // Jika filterBy NULL atau "all", ambil semua data
            query = `
                SELECT CombinedLabel, LabelType, LabelLocation FROM (
                    ${createQuery('StockOpname_Hasil_d_ST', 'NoST', 'Sawn Timber', 'ST_h')}
                    UNION ALL
                    ${createQuery('StockOpname_Hasil_d_Sanding', 'NoSanding', 'Sanding', 'Sanding_h')}
                    UNION ALL
                    ${createQuery('StockOpname_Hasil_d_S4S', 'NoS4S', 'S4S', 'S4S_h')}
                    UNION ALL
                    ${createQuery('StockOpname_Hasil_d_Moulding', 'NoMoulding', 'Moulding', 'Moulding_h')}
                    UNION ALL
                    ${createQuery('StockOpname_Hasil_d_Laminating', 'NoLaminating', 'Laminating', 'Laminating_h')}
                    UNION ALL
                    ${createQuery('StockOpname_Hasil_d_FJ', 'NoFJ', 'Finger Joint', 'FJ_h')}
                    UNION ALL
                    ${createQuery('StockOpname_Hasil_d_CCAkhir', 'NoCCAkhir', 'CC Akhir', 'CCAkhir_h')}
                    UNION ALL
                    ${createQuery('StockOpname_Hasil_d_BJ', 'NoBJ', 'Barang Jadi', 'BarangJadi_h')}
                ) AS subquery
                ORDER BY CombinedLabel
                OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
            `;

            totalCountQuery = `
                SELECT SUM(total) AS total FROM (
                    ${createTotalQuery('StockOpname_Hasil_d_ST', 'ST_h', 'NoST')}
                    UNION ALL
                    ${createTotalQuery('StockOpname_Hasil_d_Sanding', 'Sanding_h', 'NoSanding')}
                    UNION ALL
                    ${createTotalQuery('StockOpname_Hasil_d_S4S', 'S4S_h', 'NoS4S')}
                    UNION ALL
                    ${createTotalQuery('StockOpname_Hasil_d_Moulding', 'Moulding_h', 'NoMoulding')}
                    UNION ALL
                    ${createTotalQuery('StockOpname_Hasil_d_Laminating', 'Laminating_h', 'NoLaminating')}
                    UNION ALL
                    ${createTotalQuery('StockOpname_Hasil_d_FJ', 'FJ_h', 'NoFJ')}
                    UNION ALL
                    ${createTotalQuery('StockOpname_Hasil_d_CCAkhir', 'CCAkhir_h', 'NoCCAkhir')}
                    UNION ALL
                    ${createTotalQuery('StockOpname_Hasil_d_BJ', 'BarangJadi_h', 'NoBJ')}
                ) AS total_counts;
            `;
        }

        const [result, totalResult] = await Promise.all([
            request.query(query),
            request.query(totalCountQuery)
        ]);

        res.json({
            mstLokasi: mstLokasiResult.recordset,
            noLabelList: result.recordset,
            noLabelFound: result.recordset.length > 0,
            currentPage: page,
            pageSize,
            totalData: totalResult.recordset[0].total,
            totalPages: Math.ceil(totalResult.recordset[0].total / pageSize),
        });

    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    } finally {
        if (pool) await pool.close();
    }
});



// Route untuk input data ke dalam database berdasarkan No Stock Opname
router.post('/no-stock-opname/:noso/scan', verifyToken, async (req, res) => {
    const { noso } = req.params;
    const { resultscanned, idlokasi } = req.body;
    const { username } = req;  // Mengambil username dari request object

    if (!noso || !resultscanned || !idlokasi) {
        return res.status(400).json({ message: 'NoSO, resultscanned, and idlokasi are required.' });
    }

    let pool;
    try {
        pool = await connectDb();
        const request = new sql.Request(pool);
        request.input('noso', sql.VarChar, noso);
        request.input('resultscanned', sql.VarChar, resultscanned);
        request.input('idlokasi', sql.VarChar, idlokasi);
        request.input('username', sql.VarChar, username);  // Menambahkan username ke query

        // Validasi pola resultscanned
        const validPattern = /^[ERSTUVWIA]\.\d{6}$/;
        if (!validPattern.test(resultscanned)) {
            return res.status(400).json({ message: 'Format harus berupa "Kode.xxxxxx"' });
        }

        // Logika untuk memetakan resultscanned ke tabel dan melakukan pengecekan
        const firstChar = resultscanned.charAt(0).toUpperCase();
        const tableMap = {
            'E': { tableName: 'StockOpname_Hasil_d_ST', columnName: 'NoST', tableH: 'ST_h', isColumn: 'IsST' },
            'R': { tableName: 'StockOpname_Hasil_d_S4S', columnName: 'NoS4S', tableH: 'S4S_h', isColumn: 'IsS4S' },
            'S': { tableName: 'StockOpname_Hasil_d_FJ', columnName: 'NoFJ', tableH: 'FJ_h', isColumn: 'IsFJ' },
            'T': { tableName: 'StockOpname_Hasil_d_Moulding', columnName: 'NoMoulding', tableH: 'Moulding_h', isColumn: 'IsMoulding' },
            'U': { tableName: 'StockOpname_Hasil_d_Laminating', columnName: 'NoLaminating', tableH: 'Moulding_h', isColumn: 'IsLaminating' },
            'V': { tableName: 'StockOpname_Hasil_d_CCAkhir', columnName: 'NoCCAkhir', tableH: 'CCAkhir_h', isColumn: 'IsCCAkhir' },
            'W': { tableName: 'StockOpname_Hasil_d_Sanding', columnName: 'NoSanding', tableH: 'Sanding_h', isColumn: 'IsSanding' },
            'I': { tableName: 'StockOpname_Hasil_d_BJ', columnName: 'NoBJ', tableH: 'BarangJadi_h', isColumn: 'IsBJ' },
            'A': { tableName: 'StockOpname_Hasil_d_KayuBulat', columnName: 'NoKayuBulat', tableH: 'KayuBulat_h', isColumn: 'IsKB' }
        };

        const tableInfo = tableMap[firstChar];

        if (!tableInfo) {
            return res.status(400).json({ message: 'Invalid starting character for resultscanned.' });
        }

        const { tableName, columnName, tableH, isColumn } = tableInfo;

        // Ambil data dari StockOpname_h
        const checkHeaderQuery = `
            SELECT ${isColumn}
            FROM StockOpname_h
            WHERE NoSO = @noso;
        `;

        const headerResult = await request.query(checkHeaderQuery);

        if (headerResult.recordset.length === 0) {
            return res.status(404).json({ message: 'NoSO not found in StockOpname_h.' });
        }

        const isColumnEnabled = headerResult.recordset[0][isColumn];

        // Validasi apakah input diperbolehkan
        if (!isColumnEnabled) {
            return res.status(403).json({ message: `${columnName} Tidak di Aktifkan!` });
        }

        // Cek apakah data sudah ada
        const checkQuery = `
            SELECT COUNT(*) AS count
            FROM ${tableName}
            WHERE NoSO = @noso AND ${columnName} = @resultscanned;
        `;

        const duplicateResult = await request.query(checkQuery);
        const count = duplicateResult.recordset[0].count;

        if (count > 0) {
            return res.status(409).json({ message: 'Data Duplicate' });
        } else {
            // Insert dan update data
            const updateQuery = `
                UPDATE ${tableH}
                SET IdLokasi = @idlokasi
                WHERE ${columnName} = @resultscanned;
            `;

            const insertQuery = `
                INSERT INTO ${tableName} (NoSO, ${columnName}, userID, IdLokasi)
                VALUES (@noso, @resultscanned, @username, @idlokasi);
            `;

            await request.query(updateQuery);
            await request.query(insertQuery);

            return res.status(201).json({ message: 'Data inserted successfully.' });
        }

    } catch (error) {
        console.error('Error inserting/updating data:', error);
        res.status(500).json({ message: 'Failed to insert/update data.', error: error.message });
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (err) {
                console.error('Error closing connection pool:', err);
            }
        }
    }
});

module.exports = router;