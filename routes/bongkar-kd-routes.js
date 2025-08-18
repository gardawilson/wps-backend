const express = require('express');
const verifyToken = require('../middleware/verifyToken');  // Mengimpor middleware
const moment = require('moment');
const { sql, connectDb } = require('../db');
const router = express.Router();

const formatDate = (date) => {
  return moment(date).format('DD MMM YYYY');
};


// Route untuk mendapatkan daftar Bongkar KD
router.get('/kd-bongkar', verifyToken, async (req, res) => {
    try {
      await connectDb();
  
      const result = await sql.query(`
        SELECT TOP 20 [NoProcKD], [NoRuangKD], [TglMasuk], [TglKeluar]
        FROM [dbo].[KD_h]
        ORDER BY [TglMasuk] DESC
      `);
  
      if (!result.recordset || result.recordset.length === 0) {
        return res.status(404).json({ message: 'Tidak ada data Bongkar KD.' });
      }
  
      const formattedData = result.recordset.map(item => ({
        NoProcKD: item.NoProcKD,
        NoRuangKD: item.NoRuangKD,
        TglMasuk: formatDate(item.TglMasuk),
        TglKeluar: item.TglKeluar ? formatDate(item.TglKeluar) : null
      }));
  
      res.json(formattedData);
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });


  // GET /kd-bongkar/:noProcKD/detail
router.get('/kd-bongkar/:noProcKD/detail', verifyToken, async (req, res) => {
    const { noProcKD } = req.params;
  
    if (!noProcKD || noProcKD.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Parameter noProcKD harus diisi.'
      });
    }
  
    try {
      await connectDb();
  
      const request = new sql.Request();
      request.input('noProcKD', sql.VarChar, noProcKD);
  
      // Ambil data label
      const dataResult = await request.query(`
        SELECT KD.[NoProcKD], KD.[NoST], ST.[DateCreate]
        FROM KD_d KD
        LEFT JOIN ST_h ST ON KD.NoST = ST.NoST
        WHERE KD.NoProcKD = @noProcKD
          AND (
            ST.IdLokasi LIKE '%J%' OR
            ST.IdLokasi LIKE '%KD%' OR
            ST.IdLokasi IS NULL
          )
              `);
          
              // Ambil total label
              const totalResult = await request.query(`
        SELECT COUNT(*) AS totalLabel
        FROM KD_d KD
        LEFT JOIN ST_h ST ON KD.NoST = ST.NoST
        WHERE KD.NoProcKD = @noProcKD
          AND (
            ST.IdLokasi LIKE '%J%' OR
            ST.IdLokasi LIKE '%K%' OR
            ST.IdLokasi IS NULL
          )
              `);
  
      const labels = dataResult.recordset;
      const totalLabel = totalResult.recordset[0]?.totalLabel || 0;
  
      if (labels.length === 0) {
        return res.status(404).json({ message: 'Data detail KD tidak ditemukan.' });
      }

      // Format DateCreate
      const formattedLabels = labels.map(label => ({
        ...label,
        DateCreate: label.DateCreate ? formatDate(label.DateCreate) : null
      }));
  
      res.json({
        success: true,
        message: 'Data detail KD berhasil diambil.',
        data: {
          labels: formattedLabels,
          totalLabel
        }
      });
      
    } catch (error) {
      console.error('Error fetching KD detail:', error);
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  });



  //DATA LABEL YANG TELAH DI MAPPING
  router.get('/kd-bongkar/:noProcKD/detail-checked', verifyToken, async (req, res) => {
    const { noProcKD } = req.params;
  
    if (!noProcKD || noProcKD.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Parameter noProcKD harus diisi.'
      });
    }
  
    try {
      await connectDb();
  
      const request = new sql.Request();
      request.input('noProcKD', sql.VarChar, noProcKD);
  
      // Ambil data label (sudah dicek)
      const dataResult = await request.query(`
        SELECT KD.[NoProcKD], KD.[NoST], ST.[DateCreate], ST.[IdLokasi]
        FROM KD_d KD
        LEFT JOIN ST_h ST ON KD.NoST = ST.NoST
        WHERE KD.NoProcKD = @noProcKD
          AND ST.IdLokasi NOT LIKE '%J%'
          AND ST.IdLokasi NOT LIKE '%K%'
          AND ST.IdLokasi IS NOT NULL
      `);
  
      // Ambil total label
      const totalResult = await request.query(`
        SELECT COUNT(*) AS totalLabel
        FROM KD_d KD
        LEFT JOIN ST_h ST ON KD.NoST = ST.NoST
        WHERE KD.NoProcKD = @noProcKD
          AND ST.IdLokasi NOT LIKE '%J%'
          AND ST.IdLokasi NOT LIKE '%K%'
          AND ST.IdLokasi IS NOT NULL
      `);
  
      const labels = dataResult.recordset;
      const totalLabel = totalResult.recordset[0]?.totalLabel || 0;
  
      if (labels.length === 0) {
        return res.status(404).json({ message: 'Data detail KD (sudah dicek) tidak ditemukan.' });
      }
  
      // Format DateCreate
      const formattedLabels = labels.map(label => ({
        ...label,
        DateCreate: label.DateCreate ? formatDate(label.DateCreate) : null
      }));
  
      res.json({
        success: true,
        message: 'Data detail KD (sudah dicek) berhasil diambil.',
        data: {
          labels: formattedLabels,
          totalLabel
        }
      });
  
    } catch (error) {
      console.error('Error fetching KD detail (checked):', error);
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  });
  


  router.post('/kd-bongkar/check', verifyToken, async (req, res) => {
    const { noST, noProcKD } = req.body;
  
    if (!noST || !noProcKD) {
      return res.status(400).json({
        success: false,
        message: 'Parameter noST dan noProcKD wajib diisi.'
      });
    }
  
    try {
      const pool = await connectDb();
  
      // Step 1: Cek DateUsage di ST_h
      const checkDateUsageRequest = new sql.Request(pool);
      checkDateUsageRequest.input('noST', sql.VarChar, noST);
  
      const dateUsageResult = await checkDateUsageRequest.query(`
        SELECT DateUsage FROM ST_h WHERE NoST = @noST
      `);
  
      const dateUsageRow = dateUsageResult.recordset[0];
  
      // Jika NoST tidak ditemukan di ST_h
      if (!dateUsageRow) {
        return res.status(404).json({
          success: false,
          message: 'NoST tidak ditemukan.'
        });
      }
  
      // Jika DateUsage sudah terisi
      if (dateUsageRow.DateUsage !== null) {
        return res.status(200).json({
          success: false,
          message: 'Label ini telah diproses.'
        });
      }
  
      // Step 2: Cek apakah NoST ada di KD_d
      const checkKDRequest = new sql.Request(pool);
      checkKDRequest.input('noST', sql.VarChar, noST);
      checkKDRequest.input('noProcKD', sql.VarChar, noProcKD);
  
      const kdResult = await checkKDRequest.query(`
        SELECT 1 FROM KD_d WHERE NoST = @noST AND NoProcKD = @noProcKD
      `);
  
      if (kdResult.recordset.length > 0) {
        return res.status(200).json({
          success: true,
          message: 'NoST valid dan belum diproses.'
        });
      } else {
        return res.status(200).json({
          success: false,
          requireConfirmation: true,
          message: 'Label bukan bagian dari NoKD ini, yakin ingin lanjut perbaharui lokasi?'
        });
      }
  
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: 'Gagal memvalidasi NoST.',
        error: err.message
      });
    }
  });
  
 

router.post('/kd-bongkar/scan', verifyToken, async (req, res) => {
  const { noST, idLokasi } = req.body;
  const { username } = req;

  if (!noST || !idLokasi) {
    return res.status(400).json({
      success: false,
      message: 'Parameter noST dan idlokasi wajib diisi.'
    });
  }

  let pool;
  try {
    pool = await connectDb();
    const request = new sql.Request(pool);
    request.input('noST', sql.VarChar, noST);
    request.input('idlokasi', sql.VarChar, idLokasi);

    const result = await request.query(`
      UPDATE ST_h
      SET IdLokasi = @idLokasi
      WHERE NoST = @noST
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'NoST tidak ditemukan atau tidak ada perubahan.'
      });
    }

    console.log(`[${new Date().toISOString()}] ${username} update lokasi ST: ${noST} → ${idLokasi}`);

    return res.status(200).json({
      success: true,
      message: 'Lokasi berhasil diperbarui.'
    });
  } catch (error) {
    console.error('Error update lokasi:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengupdate lokasi.',
      error: error.message
    });
  } finally {
    if (pool) await pool.close();
  }
});

  
  

module.exports = router;