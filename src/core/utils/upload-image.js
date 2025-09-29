const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../uploads/kayu-bulat/images');
    fs.mkdirSync(dir, { recursive: true }); // auto bikin folder kalau belum ada
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(
      null,
      req.params.noKayuBulat +
        '-' +
        uniqueSuffix +
        path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(
      new Error('File harus berupa gambar (.jpg, .jpeg, .png, .gif)')
    );
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter });
module.exports = upload;
