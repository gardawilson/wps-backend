const express = require('express');
const verifyToken = require('../middleware/verifyToken');  // Mengimpor middleware
const moment = require('moment');
const { sql, connectDb } = require('../db');
const router = express.Router();


// Route untuk mendapatkan data Label berdasarkan No Stock Opname
router.get('/label-list/', verifyToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const filterBy = req.query.filterBy || null;
    const idlokasi = req.query.idlokasi || null;
    const offset = (page - 1) * pageSize;
    const { username } = req;  // Mengambil username dari request object

    console.log("🔍 FilterBy:", filterBy, "| IdLokasi:", idlokasi, "Username", username, "| PAGE:", page, "| PZ", pageSize);

    if (page <= 0 || pageSize <= 0) {
        return res.status(400).json({ message: 'Page and pageSize must be positive numbers.' });
    }

    let pool;
    try {
        pool = await connectDb();
        const request = new sql.Request(pool);
        request.input('username', sql.VarChar, username);  // Menambahkan username ke query

        if (idlokasi) request.input('idlokasi', sql.VarChar, idlokasi);

        // Ambil data lokasi
        const mstLokasiResult = await request.query('SELECT IdLokasi, Blok FROM MstLokasi WHERE Enable = 1');
        
        if (!mstLokasiResult.recordset || mstLokasiResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Data MstLokasi tidak ditemukan' });
        }

        let query = "";
        let totalCountQuery = "";

        function createQuery(tableName, columnName, labelType) {
            return `
                SELECT d.${columnName} AS CombinedLabel, '${labelType}' AS LabelType, d.IdLokasi AS LabelLocation
                FROM ${tableName} d
                WHERE DateUsage IS NULL
                ${idlokasi && idlokasi !== 'all' ? "AND d.IdLokasi = @idlokasi" : ""}
            `;
        }

        function createTotalQuery(tableName, columnName) {
            return `
                SELECT COUNT(*) AS total FROM ${tableName} d
                WHERE DateUsage IS NULL
                ${idlokasi && idlokasi !== 'all' ? "AND d.IdLokasi = @idlokasi" : ""}
            `;
        }

        if (filterBy && filterBy !== 'all') {
            const filterMap = {
                'st': { table: 'ST_h', column: 'NoST', type: 'Sawn Timber' },
                'sanding': { table: 'Sanding_h', column: 'NoSanding', type: 'Sanding' },
                's4s': { table: 'S4S_h', column: 'NoS4S', type: 'S4S' },
                'moulding': { table: 'Moulding_h', column: 'NoMoulding', type: 'Moulding' },
                'laminating': { table: 'Laminating_h', column: 'NoLaminating', type: 'Laminating' },
                'fj': { table: 'FJ_h', column: 'NoFJ', type: 'Finger Joint' },
                'ccakhir': { table: 'CCAkhir_h', column: 'NoCCAkhir', type: 'CC Akhir' },
                'bj': { table: 'BarangJadi_h', column: 'NoBJ', type: 'Barang Jadi' },
            };

            const selectedFilter = filterMap[filterBy];
            if (!selectedFilter) {
                return res.status(400).json({ message: "Invalid filterBy value" });
            }

            query = `
                ${createQuery(selectedFilter.table, selectedFilter.column, selectedFilter.type)}
                ORDER BY CombinedLabel
                OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY;

            `;
            totalCountQuery = createTotalQuery(selectedFilter.table, selectedFilter.column);
        } else {
            // Jika filterBy NULL atau "all", ambil semua data
            query = `
                SELECT CombinedLabel, LabelType, LabelLocation 
                FROM (
                    ${createQuery('ST_h', 'NoST', 'Sawn Timber')}
                    UNION ALL
                    ${createQuery('S4S_h', 'NoS4S', 'S4S')}
                    UNION ALL
                    ${createQuery('FJ_h', 'NoFJ', 'Finger Joint')}
                    UNION ALL
                    ${createQuery('Moulding_h', 'NoMoulding', 'Moulding')}
                    UNION ALL
                    ${createQuery('Laminating_h', 'NoLaminating', 'Laminating')}
                    UNION ALL
                    ${createQuery('CCAkhir_h', 'NoCCAkhir', 'CC Akhir')}
                    UNION ALL
                    ${createQuery('Sanding_h', 'NoSanding', 'Sanding')}
                    UNION ALL
                    ${createQuery('BarangJadi_h', 'NoBJ', 'Barang Jadi')}
                ) AS subquery
                ORDER BY CombinedLabel 
                OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
            `;

            totalCountQuery = `
                SELECT SUM(total) AS total FROM (
                    ${createTotalQuery('ST_h', 'NoST')}
                    UNION ALL
                    ${createTotalQuery('Sanding_h', 'NoSanding')}
                    UNION ALL
                    ${createTotalQuery('S4S_h', 'NoS4S')}
                    UNION ALL
                    ${createTotalQuery('Moulding_h', 'NoMoulding')}
                    UNION ALL
                    ${createTotalQuery('Laminating_h', 'NoLaminating')}
                    UNION ALL
                    ${createTotalQuery('FJ_h', 'NoFJ')}
                    UNION ALL
                    ${createTotalQuery('CCAkhir_h', 'NoCCAkhir')}
                    UNION ALL
                    ${createTotalQuery('BarangJadi_h', 'NoBJ')}
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


// Fungsi untuk pengecekan lanjutan di tabel lain berdasarkan tipe resultscanned
const checkInOtherTables = async (request, resultscanned) => {
    // Menentukan tipe tabel berdasarkan tipe resultscanned
    let tablesToCheck = [];
    let columnToSearch = ''; 
    
    // Menentukan tabel dan kolom yang relevan berdasarkan kode pertama pada resultscanned
    const firstChar = resultscanned.charAt(0).toUpperCase();

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

    }  else if (firstChar === 'I') {
        tablesToCheck = [
            { tableName: "MouldingProduksiInputBarangJadi", column: "NoProduksi" },
            { tableName: "LaminatingProduksiInputBarangJadi", column: "NoProduksi" },
            { tableName: "CCAkhirProduksiInputBarangJadi", column: "NoProduksi" },
            { tableName: "PackingProduksiInputBarangJadi", column: "NoProduksi" },
            { tableName: "BongkarSusunInputBarangJadi", column: "NoBongkarSusun" }
        ];
        columnToSearch = 'NoBJ'; 

    } else {
        // Jika resultscanned bukan 'E' atau 'R', bisa menambahkan logika lain atau handling error
        return { message: 'Invalid resultscanned type', status: 400 };
    }

    // Pengecekan tabel sesuai dengan daftar yang sudah ditentukan
    for (let table of tablesToCheck) {
        const checkQuery = `
            SELECT ${table.column}
            FROM ${table.tableName}
            WHERE ${columnToSearch} = @resultscanned;
        `;
        
        const resultCheck = await request.query(checkQuery);

        if (resultCheck.recordset.length > 0) {
            const value = resultCheck.recordset[0][table.column]; // Ambil nilai kolom yang sesuai
            return { 
                message: `Label sudah di Proses pada Nomor ${value}. Yakin ingin menyimpan?`, 
                status: 409,
                value: value // Kembalikan nilai kolom yang ditemukan
            };
        }
    }

    return null; // Tidak ada masalah
};



// Route untuk pengecekan data berdasarkan No Stock Opname
router.post('/label-list/check', verifyToken, async (req, res) => {
    const { resultscanned, idlokasi } = req.body;
    const { username } = req;  // Mengambil username dari request object

    if (!resultscanned || !idlokasi) {
        return res.status(400).json({ message: 'Resultscanned, and idlokasi are required.' });
    }

    let pool;
    try {
        pool = await connectDb();
        const request = new sql.Request(pool);
        request.input('resultscanned', sql.VarChar, resultscanned);
        request.input('idlokasi', sql.VarChar, idlokasi);
        request.input('username', sql.VarChar, username);

        // Validasi pola resultscanned
        const validPattern = /^[ERSTUVWIA]\.\d{6}$/;
        if (!validPattern.test(resultscanned)) {
            return res.status(400).json({ message: 'Format harus berupa "Kode.xxxxxx"' });
        }

        const firstChar = resultscanned.charAt(0).toUpperCase();
        const tableMap = {
            'E': { columnName: 'NoST', tableH: 'ST_h', isColumn: 'IsST' },
            'R': { columnName: 'NoS4S', tableH: 'S4S_h', isColumn: 'IsS4S' },
            'S': { columnName: 'NoFJ', tableH: 'FJ_h', isColumn: 'IsFJ' },
            'T': { columnName: 'NoMoulding', tableH: 'Moulding_h', isColumn: 'IsMoulding' },
            'U': { columnName: 'NoLaminating', tableH: 'Laminating_h', isColumn: 'IsLaminating' },
            'V': { columnName: 'NoCCAkhir', tableH: 'CCAkhir_h', isColumn: 'IsCCAkhir' },
            'W': { columnName: 'NoSanding', tableH: 'Sanding_h', isColumn: 'IsSanding' },
            'I': { columnName: 'NoBJ', tableH: 'BarangJadi_h', isColumn: 'IsBJ' },
        };

        const tableInfo = tableMap[firstChar];

        if (!tableInfo) {
            return res.status(400).json({ message: 'Invalid starting character for resultscanned.' });
        }

        const { columnName, tableH, isColumn } = tableInfo;

        // **Pengecekan apakah resultscanned ada di table yang sesuai**
        const checkResultScannedQuery = `
            SELECT COUNT(*) AS count, MAX(dateusage) AS dateusage
            FROM ${tableH}
            WHERE ${columnName} = @resultscanned;
        `;
        const resultScannedCheck = await request.query(checkResultScannedQuery);
        const resultScannedCount = resultScannedCheck.recordset[0].count;
        const dateusage = resultScannedCheck.recordset[0].dateusage;

        // Jika tidak ada data yang cocok, kembalikan pesan bahwa data tidak terdaftar
        if (resultScannedCount === 0) {
            return res.status(404).json({ message: 'Label tidak ada di sistem. Yakin ingin menyimpan?' });
        }

        // Cek untuk dateusage jika ada
        if (dateusage !== null) {
            // Pengecekan pada tabel lain
            const otherTableCheck = await checkInOtherTables(request, resultscanned);
            if (otherTableCheck) {
                return res.status(otherTableCheck.status).json({ message: otherTableCheck.message });
            }
        }

        return res.status(200).json({ message: 'Pengecekan berhasil, label ada di sistem.' });

    } catch (error) {
        console.error('Error checking data:', error);
        res.status(500).json({ message: 'Failed to check data.', error: error.message });
    }
});


router.post('/label-list/save-changes', verifyToken, async (req, res) => {
    const { resultscannedList, idlokasi } = req.body;
    const { username } = req;

    if (!resultscannedList || resultscannedList.length === 0 || !idlokasi) {
        return res.status(400).json({ message: 'Resultscanned list and idlokasi are required.' });
    }

    let pool;
    try {
        pool = await connectDb();
        const request = new sql.Request(pool);
        request.input('idlokasi', sql.VarChar, idlokasi);
        request.input('username', sql.VarChar, username);

        // Loop untuk memproses semua resultscanned
        for (let i = 0; i < resultscannedList.length; i++) {
            const resultscanned = resultscannedList[i];

            // Buat parameter unik untuk setiap iterasi
            const resultscannedParamName = `resultscanned_${i}`;

            request.input(resultscannedParamName, sql.VarChar, resultscanned);

            // Validasi pola resultscanned
            const validPattern = /^[ERSTUVWIA]\.\d{6}$/;
            if (!validPattern.test(resultscanned)) {
                return res.status(400).json({ message: `Format untuk ${resultscanned} harus berupa "Kode.xxxxxx"` });
            }

            const firstChar = resultscanned.charAt(0).toUpperCase();
            const tableMap = {
                'E': { columnName: 'NoST', tableH: 'ST_h' },
                'R': { columnName: 'NoS4S', tableH: 'S4S_h' },
                'S': { columnName: 'NoFJ', tableH: 'FJ_h' },
                'T': { columnName: 'NoMoulding', tableH: 'Moulding_h' },
                'U': { columnName: 'NoLaminating', tableH: 'Laminating_h' },
                'V': { columnName: 'NoCCAkhir', tableH: 'CCAkhir_h' },
                'W': { columnName: 'NoSanding', tableH: 'Sanding_h' },
                'I': { columnName: 'NoBJ', tableH: 'BarangJadi_h' },
            };

            const tableInfo = tableMap[firstChar];

            if (!tableInfo) {
                return res.status(400).json({ message: `Invalid starting character for ${resultscanned}.` });
            }

            const { columnName, tableH } = tableInfo;

            // Insert logic untuk menyimpan data
            const updateQuery = `
                UPDATE ${tableH}
                SET IdLokasi = @idlokasi
                WHERE ${columnName} = @${resultscannedParamName};
            `;
            await request.query(updateQuery);
        }

        return res.status(201).json({ message: 'Data berhasil disimpan.' });

    } catch (error) {
        console.error('Error inserting data:', error);
        res.status(500).json({ message: 'Failed to insert data.', error: error.message });
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