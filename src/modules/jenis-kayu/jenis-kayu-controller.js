const jenisKayuService = require('./jenis-kayu-service');

// GET /jenis-kayu — hanya Enable = 1
exports.getAll = async (_req, res) => {
  try {
    const rows = await jenisKayuService.getAll({ enable: true });
    res.status(200).json({
      success: true,
      message: 'Data jenis kayu (aktif saja)',
      total: rows.length,
      data: rows
    });
  } catch (e) {
    console.error('Error getAllEnabled jenis kayu:', e);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan di server' });
  }
};
