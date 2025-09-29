const { sql, connectDb } = require('../../core/config/db');
const { formatDate, formatTime } = require('../../core/utils/format-utils');
const moment = require('moment');

exports.getLabelData = async (nolabel) => {
  const pool = await connectDb();
  const request = pool.request().input('nolabel', sql.NVarChar, nolabel);

  if (nolabel.startsWith('E')) {
    // query header & detail ST
    const resultHeader = await request.query(`
      SELECT ST.NoKayuBulat, SP.NmSupplier, KBH.NoTruk, ST.DateCreate, MJ.Jenis,
             ST.NoSPK, T.NamaOrgTelly, S.NamaStickBy, B.Buyer AS BuyerNoSPK,
             ST.IdUOMTblLebar, ST.IdUOMPanjang, KBH.NoPlat, ST.IsSLP, ST.Remark
      FROM ST_h ST
      LEFT JOIN KayuBulat_h KBH ON ST.NoKayuBulat = KBH.NoKayuBulat
      LEFT JOIN MstJenisKayu MJ ON ST.IdJenisKayu = MJ.IdJenisKayu
      LEFT JOIN MstSPK_h SPK ON ST.NoSPK = SPK.NoSPK
      LEFT JOIN MstBuyer B ON SPK.IdBuyer = B.IdBuyer
      LEFT JOIN MstOrgTelly T ON ST.IdOrgTelly = T.IdOrgTelly
      LEFT JOIN MstStickBy S ON ST.IdStickBy = S.IdStickBy
      LEFT JOIN MstSupplier SP ON KBH.IdSupplier = SP.IdSupplier
      WHERE ST.NoST = @nolabel
    `);

    const resultDetail = await request.query(`
      SELECT NoST, NoUrut, Tebal, Lebar, Panjang, JmlhBatang
      FROM ST_d
      WHERE NoST = @nolabel
    `);

    if (!resultHeader.recordset.length) return null;

    // hitung total
    let totalJumlah = 0, totalM3 = 0, totalTon = 0;
    const idUOMTblLebar = resultHeader.recordset[0].IdUOMTblLebar;

    const details = resultDetail.recordset.map(item => {
      const pcs = item.JmlhBatang;
      let rowTON, rowM3;

      if (idUOMTblLebar === 1) {
        rowTON = ((item.Tebal * item.Lebar * item.Panjang * pcs * 304.8) / 1e9 / 1.416);
        rowM3  = rowTON * 1.416;
      } else {
        rowTON = ((item.Tebal * item.Lebar * item.Panjang * pcs) / 7200.8);
        rowM3  = rowTON * 1.416;
      }

      rowTON = Math.floor(rowTON * 10000) / 10000;
      rowM3  = Math.floor(rowM3 * 10000) / 10000;

      totalJumlah += pcs;
      totalM3 += rowM3;
      totalTon += rowTON;

      return {
        NoUrut: item.NoUrut,
        Tebal: item.Tebal,
        Lebar: item.Lebar,
        Panjang: item.Panjang,
        JmlhBatang: pcs,
        RowTON: rowTON,
        RowM3: rowM3,
      };
    });

    return {
      header: resultHeader.recordset.map(h => ({
        ...h,
        DateCreate: formatDate(h.DateCreate),
        FormatMMYY: moment(h.DateCreate).format('MMYY'),
      })),
      details,
      total: {
        jumlah: totalJumlah,
        m3: totalM3.toFixed(4),
        ton: totalTon.toFixed(4),
      },
    };
  }

  if (nolabel.startsWith('R')) {
    // query header & detail S4S
    const resultHeader = await request.query(`
      SELECT o.NoProduksi, h.DateCreate, h.Jam, t.NamaOrgTelly, h.NoSPK,
             g.NamaGrade, h.IdFisik, m.NamaMesin, s.NoBongkarSusun,
             f.Profile, w.NamaWarehouse, k.Jenis, h.IsLembur, h.IsReject, h.Remark
      FROM S4S_h h
      LEFT JOIN S4SProduksiOutput o ON h.NoS4S = o.NoS4S
      LEFT JOIN MstGrade g ON h.IdGrade = g.IdGrade
      LEFT JOIN S4SProduksi_h p ON o.NoProduksi = p.NoProduksi
      LEFT JOIN BongkarSusunOutputS4S s ON h.NoS4S = s.NoS4S
      LEFT JOIN MstMesin m ON p.IdMesin = m.IdMesin
      LEFT JOIN MstOrgTelly t ON h.IdOrgTelly = t.IdOrgTelly
      LEFT JOIN MstFJProfile f ON h.IdFJProfile = f.IdFJProfile
      LEFT JOIN MstWarehouse w ON h.IdFisik = w.IdWarehouse
      LEFT JOIN MstJenisKayu k ON h.IdJenisKayu = k.IdJenisKayu
      WHERE h.NoS4S = @nolabel
    `);

    const resultDetail = await request.query(`
      SELECT NoS4S, NoUrut, Tebal, Lebar, Panjang, JmlhBatang
      FROM S4S_d
      WHERE NoS4S = @nolabel
    `);

    if (!resultHeader.recordset.length) return null;

    let totalJumlah = 0, totalM3 = 0;

    const details = resultDetail.recordset.map(item => {
      const pcs = item.JmlhBatang;
      let rowM3 = (item.Tebal * item.Lebar * item.Panjang * pcs) / 1e9;
      rowM3 = Math.floor(rowM3 * 10000) / 10000;
      totalJumlah += pcs;
      totalM3 += rowM3;

      return { ...item, RowM3: rowM3 };
    });

    return {
      header: resultHeader.recordset.map(h => ({
        ...h,
        DateCreate: formatDate(h.DateCreate),
        Jam: formatTime(h.Jam),
        FormatMMYY: moment(h.DateCreate).format('MMYY'),
      })),
      details,
      total: {
        jumlah: totalJumlah,
        m3: totalM3.toFixed(4),
      },
    };
  }

  return null;
};
