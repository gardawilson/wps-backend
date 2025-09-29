const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const compressImage = async (req, res, next) => {
  if (!req.file) return next();

  const inputPath = req.file.path; // file asli dari multer
  const tempPath = inputPath + '.tmp'; // file sementara

  try {
    // Simpan hasil kompres ke file sementara
    await sharp(inputPath)
      .resize({ width: 1280 })
      .jpeg({ quality: 70 })
      .toFile(tempPath);

    // Hapus file asli
    fs.unlinkSync(inputPath);

    // Rename file sementara jadi nama asli
    fs.renameSync(tempPath, inputPath);

    // Update info file
    req.file.filename = path.basename(inputPath);
    req.file.path = inputPath;

    next();
  } catch (err) {
    console.error('Image compression error:', err);
    return res.status(500).json({ success: false, message: 'Gagal kompres image' });
  }
};

module.exports = compressImage;
