const { sql, poolPromise } = require('../../core/config/db');

exports.getAll = async ({
  q = '',
  enable = true,           // ⬅️ default aktif saja
  idGroup = null,
  isLokal = null,
  isInternal = null,
  isUpah = null,
  isST = null,
  isNonST = null,
} = {}) => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  const req = pool.request();

  const where = ['1=1'];

  if (q) { req.input('q', sql.VarChar, `%${q}%`); where.push('(jk.Jenis LIKE @q OR jk.Singkatan LIKE @q)'); }
  if (enable !== null) { req.input('enable', sql.Bit, enable); where.push('jk.Enable = @enable'); }
  if (idGroup !== null && Number.isInteger(idGroup)) { req.input('idGroup', sql.Int, idGroup); where.push('jk.IdGroup = @idGroup'); }

  const flag = (name, val) => {
    if (val !== null) { req.input(name, sql.Bit, val); where.push(`jk.${name} = @${name}`); }
  };
  flag('IsLokal', isLokal);
  flag('IsInternal', isInternal);
  flag('IsUpah', isUpah);
  flag('IsST', isST);
  flag('IsNonST', isNonST);

  const rs = await req.query(`
    SELECT
      jk.IdJenisKayu,
      jk.Jenis,
      jk.Singkatan,
      CONVERT(varchar(19), jk.DateCreate, 120) AS DateCreate,
      jk.Enable,
      jk.IdGroup,
      jk.IsLokal,
      jk.IsInternal,
      jk.IsUpah,
      jk.IsST,
      jk.IsNonST
    FROM MstJenisKayu jk
    WHERE ${where.join(' AND ')}
    ORDER BY jk.Jenis ASC, jk.IdJenisKayu DESC;
  `);

  return rs.recordset.map(r => ({
    idJenisKayu: r.IdJenisKayu,
    jenis: r.Jenis,
    singkatan: r.Singkatan,
    dateCreate: r.DateCreate,
    enable: !!r.Enable,
    idGroup: r.IdGroup,
    isLokal: !!r.IsLokal,
    isInternal: !!r.IsInternal,
    isUpah: !!r.IsUpah,
    isST: !!r.IsST,
    isNonST: !!r.IsNonST,
  }));
};