const express = require('express');
const verifyToken = require('../middleware/verifyToken');  // Mengimpor middleware
const { sql, connectDb } = require('../db');
const moment = require('moment'); // Menggunakan moment untuk format tanggal
const router = express.Router();

// Route untuk mendapatkan Data Header berdasarkan nolabel
router.get('/label-data/:nolabel', verifyToken, async (req, res) => {
  const { nolabel } = req.params;  // Mengambil nilai 'nolabel' dari parameter URL

  // Validasi untuk memastikan nolabel tidak mengandung karakter yang menyebabkan masalah
  if (!nolabel || /[^a-zA-Z0-9._-]/.test(nolabel)) {
    return res.status(400).json({ message: 'NoLabel tidak valid' });
  }

  try {
    await connectDb();

    // Query untuk mengambil data dari tabel S4S_h dan tabel terkait
    const queryHeader = `
      SELECT 
        o.NoProduksi, 
        h.DateCreate, 
        h.Jam, 
        h.IdOrgTelly, 
        t.NamaOrgTelly, 
        h.NoSPK, 
        h.NoSPKAsal, 
        h.IdGrade, 
        g.NamaGrade, 
        h.IdFJProfile, 
        h.IdFisik, 
        o.NoS4S, 
        p.IdMesin, 
        m.NamaMesin, 
        s.NoBongkarSusun, 
        f.Profile, 
        w.NamaWarehouse, 
        h.IdJenisKayu, 
        k.Jenis, 
        h.IsLembur, 
        h.IsReject, 
        h.Remark
      FROM 
        S4S_h h
      LEFT JOIN 
        S4SProduksiOutput o ON h.NoS4S = o.NoS4S
      LEFT JOIN 
        MstGrade g ON h.IdGrade = g.IdGrade
      LEFT JOIN 
        S4SProduksi_h p ON o.NoProduksi = p.NoProduksi
      LEFT JOIN 
        BongkarSusunOutputS4S s ON h.NoS4S = s.NoS4S
      LEFT JOIN 
        MstMesin m ON p.IdMesin = m.IdMesin
      LEFT JOIN 
        MstOrgTelly t ON h.IdOrgTelly = t.IdOrgTelly
      LEFT JOIN 
        MstFJProfile f ON h.IdFJProfile = f.IdFJProfile
      LEFT JOIN 
        MstWarehouse w ON h.IdFisik = w.IdWarehouse
      LEFT JOIN 
        MstJenisKayu k ON h.IdJenisKayu = k.IdJenisKayu
      WHERE 
        h.NoS4S = @nolabel
    `;

    // Query untuk mengambil data dari tabel S4S_d berdasarkan NoS4S
    const queryDetail = `
      SELECT 
        NoS4S, 
        NoUrut, 
        Tebal, 
        Lebar, 
        Panjang, 
        JmlhBatang
      FROM 
        S4S_d
      WHERE 
        NoS4S = @nolabel
    `;

    // Menyusun query dengan parameterisasi
    const request = new sql.Request();
    request.input('nolabel', sql.NVarChar, nolabel); // Menggunakan sql.input untuk parameter

    // Menjalankan query untuk mengambil data header
    const resultHeader = await request.query(queryHeader);

    // Menjalankan query untuk mengambil data detail
    const resultDetail = await request.query(queryDetail);

    if (!resultHeader.recordset || resultHeader.recordset.length === 0) {
      return res.status(404).json({ message: `Data dengan NoS4S ${nolabel} tidak ditemukan di header` });
    }

    // Variabel untuk menghitung total jumlah dan m3
    let totalJumlah = 0;
    let totalM3 = 0;

    // Format data header
    const formattedHeaderData = resultHeader.recordset.map(item => {
      // Format DateCreate menjadi FormatMMYY
      const formatMMYY = moment(item.DateCreate).format('MMYY');

      return {
        NoProduksi: item.NoProduksi,
        DateCreate: formatDate(item.DateCreate),
        Jam: formatTime(item.Jam),
        NamaOrgTelly: item.NamaOrgTelly,
        NoSPK: item.NoSPK,
        NamaGrade: item.NamaGrade,
        IdFisik: item.IdFisik,
        NamaMesin: item.NamaMesin,
        NoBongkarSusun: item.NoBongkarSusun,
        Profile: item.Profile,
        NamaWarehouse: item.NamaWarehouse,
        Jenis: item.Jenis,
        IsLembur: item.IsLembur,
        IsReject: item.IsReject,
        Remark: item.Remark,
        FormatMMYY: formatMMYY // Menambahkan FormatMMYY
      };
    });

    // Format data detail dan menghitung jumlah serta m3
    const formattedDetailData = resultDetail.recordset.map(item => {
      const tebal = item.Tebal;
      const lebar = item.Lebar;
      const panjang = item.Panjang;
      const pcs = item.JmlhBatang;

      // Menghitung m3 untuk setiap detail
      let rowM3 = (tebal * lebar * panjang * pcs) / 1000000000.0;
      rowM3 = Math.floor(rowM3 * 10000) / 10000;

      // Menambahkan m3 ke totalM3
      totalM3 += rowM3;

      // Menambahkan jumlah batang ke totalJumlah
      totalJumlah += pcs;

      return {
        NoUrut: item.NoUrut,
        Tebal: item.Tebal,
        Lebar: item.Lebar,
        Panjang: item.Panjang,
        JmlhBatang: item.JmlhBatang
      };
    });

    // Format totalM3 dengan 4 angka di belakang koma
    const formattedM3 = totalM3.toFixed(4);

    // Menggabungkan data header, detail, dan total dalam response
    res.json({
      header: formattedHeaderData,
      details: formattedDetailData,
      total: {
        jumlah: totalJumlah,
        m3: formattedM3
      }
    });

  } catch (error) {
    console.error('Error details:', error);  // Menampilkan error lebih rinci
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

// Fungsi untuk memformat tanggal dengan format DD-MMM-YYYY
function formatDate(date) {
  return moment(date).format('DD-MMM-YYYY');
}

// Fungsi untuk memformat waktu dengan format HH:mm
function formatTime(time) {
  const timeString = moment.utc(time).format('HH:mm');
  return timeString;
}

module.exports = router;
