const { sql, poolPromise } = require('../../core/config/db');

// Ambil semua (tanpa pagination), default enableOnly = true
exports.getAll = async ({
  q = '',
  type = '',
  isSLP = null,
  isGroup = null,
  idGroupMesinSawmill = null,
  enableOnly = true,
} = {}) => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  const req = pool.request();

  const where = ['1=1'];

  if (enableOnly) {
    where.push('m.Enable = 1');
  }
  if (q) {
    req.input('q', sql.VarChar, `%${q}%`);
    where.push('(m.NamaMeja LIKE @q OR m.NoMeja LIKE @q)');
  }
  if (type) {
    req.input('type', sql.VarChar, type);
    where.push('m.[Type] = @type');
  }
  if (isSLP !== null) {
    req.input('isSLP', sql.Bit, isSLP);
    where.push('m.IsSLP = @isSLP');
  }
  if (isGroup !== null) {
    req.input('isGroup', sql.Bit, isGroup);
    where.push('m.IsGroup = @isGroup');
  }
  if (idGroupMesinSawmill !== null && Number.isInteger(idGroupMesinSawmill)) {
    req.input('idGroup', sql.Int, idGroupMesinSawmill);
    where.push('m.IdGroupMesinSawmill = @idGroup');
  }

  const rs = await req.query(`
    SELECT
      m.NoMeja,
      m.IsSLP,
      m.IsGroup,
      m.[Type],
      m.Enable,
      m.IdGroupMesinSawmill,
      m.IdOperator1,
      m.IdOperator2,
      m.NamaMeja
    FROM MstMesinSawmill m
    WHERE ${where.join(' AND ')}
    ORDER BY m.NamaMeja ASC, m.NoMeja ASC;
  `);

  return rs.recordset.map(r => ({
    noMeja: r.NoMeja,
    isSLP: !!r.IsSLP,
    isGroup: !!r.IsGroup,
    type: r.Type,
    enable: !!r.Enable,
    idGroupMesinSawmill: r.IdGroupMesinSawmill,
    idOperator1: r.IdOperator1,
    idOperator2: r.IdOperator2,
    namaMeja: r.NamaMeja,
  }));
};

