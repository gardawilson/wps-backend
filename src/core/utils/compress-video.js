const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const compressVideo = (req, res, next) => {
  if (!req.file) return next();

  const inputPath = req.file.path; // path video asli dari multer
  const tempPath = inputPath + '.tmp.mp4'; // file sementara

  try {
    ffmpeg(inputPath)
      .outputOptions([
        '-vcodec libx264',   // codec video H.264
        '-crf 28',           // kualitas (18 lebih bagus, 28 lebih kecil ukuran)
        '-preset veryfast',  // kecepatan kompresi
        '-acodec aac',       // codec audio
        '-b:a 128k'          // bitrate audio
      ])
      .size('?x720')         // resize max tinggi 720p (optional)
      .save(tempPath)
      .on('end', () => {
        // Hapus file asli
        fs.unlinkSync(inputPath);

        // Rename hasil kompres
        fs.renameSync(tempPath, inputPath);

        // Update req.file
        req.file.filename = path.basename(inputPath);
        req.file.path = inputPath;

        next();
      })
      .on('error', (err) => {
        console.error('Video compression error:', err);
        return res.status(500).json({ success: false, message: 'Gagal kompres video' });
      });
  } catch (err) {
    console.error('Video compression exception:', err);
    return res.status(500).json({ success: false, message: 'Gagal kompres video' });
  }
};

module.exports = compressVideo;
