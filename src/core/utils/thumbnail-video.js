const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

async function generateThumbnail(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    try {
      fs.mkdirSync(outputDir, { recursive: true });

      const fileName = path.basename(videoPath, path.extname(videoPath)) + '.jpg';
      const outputPath = path.join(outputDir, fileName);

      ffmpeg(videoPath)
        .on('end', () => resolve(fileName)) // return nama file thumbnail
        .on('error', reject)
        .screenshots({
          count: 1,
          timemarks: ['00:00:02.000'], // ambil frame detik ke-2
          filename: fileName,
          folder: outputDir,
          size: '320x240'
        });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateThumbnail };
