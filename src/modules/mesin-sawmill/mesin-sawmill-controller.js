const mesinSawmillService = require('./mesin-sawmill-service');

const toBool = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim();
  if (s === '1' || /^true$/i.test(s) || /^ya$/i.test(s)) return true;
  if (s === '0' || /^false$/i.test(s) || /^tidak$/i.test(s)) return false;
  return null;
};

// GET /mesin-sawmill — aktif saja
exports.getAllEnabled = async (req, res) => {
  const q = (req.query.q || '').trim(); // cari NamaMeja / NoMeja
  const type = (req.query.type || '').trim();
  const isSLP   = toBool(req.query.isSLP);
  const isGroup = toBool(req.query.isGroup);
  const idGroupMesinSawmill = req.query.idGroupMesinSawmill
    ? parseInt(req.query.idGroupMesinSawmill, 10)
    : null;

  try {
    const rows = await mesinSawmillService.getAll({
      q, type, isSLP, isGroup, idGroupMesinSawmill,
      enableOnly: true, // paksa aktif saja
    });
    res.status(200).json({
      success: true,
      message: 'Data mesin sawmill (aktif saja)',
      total: rows.length,
      data: rows,
    });
  } catch (e) {
    console.error('Error getAllEnabled mesin sawmill:', e);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan di server' });
  }
};
