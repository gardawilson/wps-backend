const express = require('express');
const verifyToken = require('../middleware/verifyToken');  // Mengimpor middleware
const { sql, connectDb } = require('../db');
const moment = require('moment'); // Menggunakan moment untuk format tanggal
const router = express.Router();

// Route untuk mendapatkan Data Header berdasarkan nolabel
router.get('/label-data/:nolabel', verifyToken, async (req, res) => {
  const { nolabel } = req.params;  // Mengambil nilai 'nolabel' dari parameter URL
  const { username } = req;  // Mengambil username dari request object



  // Validasi untuk memastikan nolabel tidak mengandung karakter yang menyebabkan masalah
  if (!nolabel || /[^a-zA-Z0-9._-]/.test(nolabel)) {
    return res.status(400).json({ message: 'NoLabel tidak valid' });
  }

  try {
    await connectDb();

    if (nolabel.charAt(0) === 'E') {
      // Jika huruf pertama adalah 'E', lakukan query ST_h
      const queryHeader = `
        SELECT 
          ST.NoKayuBulat, 
          SP.NmSupplier,
          KBH.NoTruk,
          ST.DateCreate, 
          MJ.Jenis, 
          ST.NoSPK, 
          T.NamaOrgTelly,
          S.NamaStickBy,
          B.Buyer AS BuyerNoSPK, 
          ST.IdUOMTblLebar, 
          ST.IdUOMPanjang, 
          KBH.NoPlat,
          ST.IsSLP,
          ST.Remark
        FROM 
          ST_h ST
        LEFT JOIN 
          KayuBulat_h KBH ON ST.NoKayuBulat = KBH.NoKayuBulat
        LEFT JOIN 
          MstJenisKayu MJ ON ST.IdJenisKayu = MJ.IdJenisKayu
        LEFT JOIN 
          MstSPK_h SPK ON ST.NoSPK = SPK.NoSPK
        LEFT JOIN 
          MstBuyer B ON SPK.IdBuyer = B.IdBuyer
        LEFT JOIN 
          MstOrgTelly T ON ST.IdOrgTelly = T.IdOrgTelly
        LEFT JOIN 
          MstStickBy S ON ST.IdStickBy = S.IdStickBy
        LEFT JOIN 
          MstSupplier SP ON KBH.IdSupplier = SP.IdSupplier
        WHERE 
          ST.NoST = @nolabel
      `;
    
      const queryDetail = `
        SELECT 
          NoST, 
          NoUrut, 
          Tebal, 
          Lebar, 
          Panjang, 
          JmlhBatang
        FROM 
          ST_d
        WHERE 
          NoST = @nolabel
      `;
      
      // Menyusun query dengan parameterisasi untuk 'E'
      const request = new sql.Request();
      request.input('nolabel', sql.NVarChar, nolabel);
    
      // Menjalankan query untuk mengambil data header 'ST_h'
      const resultHeader = await request.query(queryHeader);
      const resultDetail = await request.query(queryDetail);
    
      if (!resultHeader.recordset || resultHeader.recordset.length === 0) {
        return res.status(404).json({ message: `Data dengan NoST ${nolabel} tidak ditemukan` });
      }
    
      // Variabel untuk menghitung total jumlah, m3, dan ton
      let totalJumlah = 0;  // Jumlah total dari pcs (JmlhBatang)
      let totalM3 = 0;
      let totalTon = 0;
    
      // Format data header ST_h
      const formattedHeaderData = resultHeader.recordset.map(item => {
        const formatMMYY = moment(item.DateCreate).format('MMYY');

        return {
          NoKayuBulat: item.NoKayuBulat,
          NmSupplier: item.NmSupplier,
          NoTruk: item.NoTruk,
          DateCreate: formatDate(item.DateCreate),
          Jenis: item.Jenis,
          NoSPK: item.NoSPK,
          NamaOrgTelly: item.NamaOrgTelly,
          NamaStickBy: item.NamaStickBy,
          BuyerNoSPK: item.BuyerNoSPK,
          IdUOMTblLebar: item.IdUOMTblLebar,
          IdUOMPanjang: item.IdUOMPanjang,
          NoPlat: item.NoPlat,
          IsSLP: item.IsSLP,
          Remark: item.Remark,
          FormatMMYY: formatMMYY
        };
      });
    
      const formattedDetailData = resultDetail.recordset.map(item => {
        const tebal = item.Tebal;
        const lebar = item.Lebar;
        const panjang = item.Panjang;
        const pcs = item.JmlhBatang;
        const idUOMTblLebar = resultHeader.recordset[0].IdUOMTblLebar; // Ambil idUOMTblLebar dari header data
    
        let rowTON = 0;
        let rowM3 = 0;
    
        // Perhitungan berdasarkan IdUOMTblLebar
        if (idUOMTblLebar === 1) { // Jika menggunakan milimeter
          rowTON = ((tebal * lebar * panjang * pcs * 304.8 / 1000000000 / 1.416 * 10000) / 10000);
          rowM3 = ((tebal * lebar * panjang * pcs * 304.8 / 1000000000 / 1.416 * 10000) / 10000) * 1.416;
        } else { // Satuan lainnya
          rowTON = ((tebal * lebar * panjang * pcs / 7200.8 * 10000) / 10000);
          rowM3 = ((tebal * lebar * panjang * pcs / 7200.8 * 10000) / 10000) * 1.416;
        }
    
        // Membulatkan ke 4 desimal
        rowTON = Math.floor(rowTON * 10000) / 10000;
        rowM3 = Math.floor(rowM3 * 10000) / 10000;
    
        // Menambahkan ke total
        totalM3 += rowM3;
        totalTon += rowTON;
        totalJumlah += pcs;  // Menjumlahkan pcs (JmlhBatang)
    
        return {
          NoUrut: item.NoUrut,
          Tebal: item.Tebal,
          Lebar: item.Lebar,
          Panjang: item.Panjang,
          JmlhBatang: item.JmlhBatang,
          RowTON: rowTON,
          RowM3: rowM3
        };
      });
    
      // Menghitung total m3 dan ton yang diformat
      const formattedM3 = totalM3.toFixed(4);
      const formattedTon = totalTon.toFixed(4);
    
      // Menggabungkan data header, detail, dan total dalam response
      res.json({
        header: formattedHeaderData,
        details: formattedDetailData,
        total: {
          jumlah: totalJumlah,  // Jumlah total pcs
          m3: formattedM3,
          ton: formattedTon
        },
        username: username
      });
    }
     else if (nolabel.charAt(0) === 'R') {
      // Jika huruf pertama adalah 'R', lakukan query S4S_h (seperti yang sudah ada)
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
      request.input('nolabel', sql.NVarChar, nolabel);

      const resultHeader = await request.query(queryHeader);
      const resultDetail = await request.query(queryDetail);

      if (!resultHeader.recordset || resultHeader.recordset.length === 0) {
        return res.status(404).json({ message: `Data dengan NoS4S ${nolabel} tidak ditemukan di header` });
      }

      // Variabel untuk menghitung total jumlah dan m3
      let totalJumlah = 0;
      let totalM3 = 0;

      // Format data header
      const formattedHeaderData = resultHeader.recordset.map(item => {
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
          FormatMMYY: formatMMYY
        };
      });

      const formattedDetailData = resultDetail.recordset.map(item => {
        const tebal = item.Tebal;
        const lebar = item.Lebar;
        const panjang = item.Panjang;
        const pcs = item.JmlhBatang;

        let rowM3 = (tebal * lebar * panjang * pcs) / 1000000000.0;
        rowM3 = Math.floor(rowM3 * 10000) / 10000;
        totalM3 += rowM3;
        totalJumlah += pcs;

        return {
          NoUrut: item.NoUrut,
          Tebal: item.Tebal,
          Lebar: item.Lebar,
          Panjang: item.Panjang,
          JmlhBatang: item.JmlhBatang
        };
      });

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
    }

  } catch (error) {
    console.error('Error details:', error);
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
