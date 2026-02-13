const { sql, poolPromise } = require("../../core/config/db");

exports.getProdukSpk = async ({ Tebal, Lebar, IdJenisKayu }) => {
  const pool = await poolPromise;
  const request = pool.request();

  request.input("Tebal", sql.Decimal(18, 4), Tebal);
  request.input("Lebar", sql.Decimal(18, 4), Lebar);
  request.input("IdJenisKayu", sql.Int, IdJenisKayu);

  const query = `
    SELECT 
        h.IdProdukSPK,
        h.NamaProduk,
        spk.NoSPK,
        spk.Ton
    FROM MstProdukSPK h
    INNER JOIN MstProdukSPK_d d
        ON h.IdProdukSPK = d.IdProdukSPK
    INNER JOIN MstTargetGroupingKayu_d tg
        ON h.IdTargetGroupingKayu = tg.IdTargetGroupingKayu
    INNER JOIN MstJenisKayu jk
        ON tg.IdGroup = jk.IdGroup
    INNER JOIN MstSPK_dProdukSPK spk
        ON h.IdProdukSPK = spk.IdProdukSPK
    WHERE 
        d.Tebal = @Tebal
        AND d.Lebar = @Lebar
        AND jk.IdJenisKayu = @IdJenisKayu
    ORDER BY 
        spk.NoSPK ASC,
        h.NamaProduk ASC
  `;

  const result = await request.query(query);
  return result.recordset;
};

exports.getSisaTon = async ({ NoSPK, IdProdukSPK }) => {
  const pool = await poolPromise;
  const request = pool.request();

  request.input("NoSPK", sql.VarChar(50), NoSPK);
  request.input("IdProdukSPK", sql.Int, IdProdukSPK);

  const query = `
    SELECT 
        spk.NoSPK,
        spk.IdProdukSPK,
        spk.Ton AS TargetTon,
        spk.Ton -
        ISNULL((
            SELECT SUM(
                CASE 
                    WHEN d.IdUOMTblLebar = 1 AND d.IdUOMPanjang = 4 THEN
                        FLOOR(d.Tebal * d.Lebar * d.Panjang * 304.8 * d.JmlhBatang 
                              / 1000000000 / 1.416 * 10000) / 10000
                    WHEN d.IdUOMTblLebar = 3 AND d.IdUOMPanjang = 4 THEN
                        FLOOR(d.Tebal * d.Lebar * d.Panjang * d.JmlhBatang 
                              / 7200.8 * 10000) / 10000
                END
            )
            FROM STSawmill_d d
            WHERE d.NoSPK = spk.NoSPK
              AND d.IdProdukSPK = spk.IdProdukSPK
        ), 0) AS SisaTon
    FROM MstSPK_dProdukSPK spk
    WHERE spk.NoSPK = @NoSPK
      AND spk.IdProdukSPK = @IdProdukSPK
  `;

  const result = await request.query(query);

  if (!result.recordset.length) {
    return {
      NoSPK,
      IdProdukSPK,
      TargetTon: 0,
      SisaTon: 0,
    };
  }

  return result.recordset[0];
};
