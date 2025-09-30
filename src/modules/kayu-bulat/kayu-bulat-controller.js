const kayuBulatService = require('./kayu-bulat-service');
const fs = require("fs");
const path = require("path");
const { generateThumbnail } = require('../../core/utils/thumbnail-video');


// GET all
exports.getAllKayuBulat = async (req, res) => {
  try {
    const data = await kayuBulatService.getAll();
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    console.error('Error fetching Kayu Bulat:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET by ID
exports.getKayuBulatById = async (req, res) => {
  try {
    const data = await kayuBulatService.getById(req.params.noKayuBulat);
    if (!data) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CREATE
exports.createKayuBulat = async (req, res) => {
  try {
    const created = await kayuBulatService.create(req.body);
    res.status(201).json({ success: true, message: 'Data berhasil ditambahkan', data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE
exports.updateKayuBulat = async (req, res) => {
  try {
    const updated = await kayuBulatService.update(req.params.noKayuBulat, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    res.json({ success: true, message: 'Data berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE
exports.deleteKayuBulat = async (req, res) => {
  try {
    const deleted = await kayuBulatService.remove(req.params.noKayuBulat);
    if (!deleted) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    res.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPLOAD IMAGE
exports.uploadImage = async (req, res) => {
  try {
    const { tier, pcs } = req.body;
    const { noKayuBulat } = req.params;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'Tidak ada file yang diupload' });
    }

    const fileName = req.file.filename;

    await kayuBulatService.saveImage({
      noKayuBulat,
      tier: parseInt(tier, 10),
      imageName: fileName,
      pcs: parseInt(pcs, 10) || 0,
    });

    res.json({
      success: true,
      message: 'Gambar berhasil diupload & dikompres',
      data: { noKayuBulat, tier, imageName: fileName, pcs },
    });
  } catch (err) {
    console.error('Error upload image:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.uploadVideo = async (req, res) => {
  try {
    const { noUrut, remark } = req.body;
    const { noKayuBulat } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada video yang diupload' });
    }

    const fileName = req.file.filename;
    const videoPath = req.file.path;

    // 🔹 Generate thumbnail
    const thumbDir = path.join(__dirname, '../../../storage/kayu-bulat/videos/thumbs');
    const thumbName = await generateThumbnail(videoPath, thumbDir);

    // 🔹 Save ke DB
    await kayuBulatService.saveVideo({
      noKayuBulat,
      noUrut: parseInt(noUrut, 10),
      videoName: fileName,
      remark,
      videoThumbnail: thumbName,
    });

    res.json({
      success: true,
      message: 'Video berhasil diupload',
      data: { noKayuBulat, noUrut, videoName: fileName, remark, videoThumbnail: thumbName },
    });
  } catch (err) {
    console.error('Error upload video:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};




// controllers/kayu-bulat-controller.js
exports.getAttachments = async (req, res) => {
  try {
    const { noKayuBulat } = req.params;
    const attachments = await kayuBulatService.getAttachments(noKayuBulat);

    res.json({
      success: true,
      data: attachments
    });
  } catch (err) {
    console.error('Error get attachments:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.streamVideo = (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, "../../storage/kayu-bulat/videos", fileName);

    fs.stat(filePath, (err, stats) => {
      if (err) {
        console.error("Video not found:", err);
        return res.sendStatus(404);
      }

      let range = req.headers.range;
      if (!range) {
        // tidak ada Range → kirim full file
        res.writeHead(200, {
          "Content-Length": stats.size,
          "Content-Type": "video/mp4",
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      const CHUNK_SIZE = 10 ** 6; // 1 MB
      const start = Number(range.replace(/\D/g, ""));
      const end = Math.min(start + CHUNK_SIZE, stats.size - 1);

      const contentLength = end - start + 1;
      const headers = {
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
      };

      res.writeHead(206, headers);
      fs.createReadStream(filePath, { start, end }).pipe(res);
    });
  } catch (err) {
    console.error("Error stream video:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



// UPDATE IMAGE DATA (tanpa file)
exports.updateImageData = async (req, res) => {
  try {
    const { noKayuBulat } = req.params;
    const { tier, pcs, note } = req.body;

    await kayuBulatService.updateImageData({
      noKayuBulat,
      tier: parseInt(tier, 10),
      pcs: parseInt(pcs, 10) || 0,
      note: note || null,
    });

    res.json({
      success: true,
      message: 'Data gambar berhasil diupdate tanpa upload file',
      data: { noKayuBulat, tier, pcs, note },
    });
  } catch (err) {
    console.error('Error update image data:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE VIDEO DATA (tanpa file)
exports.updateVideoData = async (req, res) => {
  try {
    const { noKayuBulat } = req.params;
    const { noUrut, remark } = req.body;

    await kayuBulatService.updateVideoData({
      noKayuBulat,
      noUrut: parseInt(noUrut, 10),
      remark: remark || null,
    });

    res.json({
      success: true,
      message: 'Data video berhasil diupdate tanpa upload file',
      data: { noKayuBulat, noUrut, remark },
    });
  } catch (err) {
    console.error('Error update video data:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// DELETE IMAGE
exports.deleteImage = async (req, res) => {
  try {
    const { noKayuBulat, tier } = req.params;
    const result = await kayuBulatService.deleteImage({
      noKayuBulat,
      tier: parseInt(tier, 10),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Error delete image:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};




// DELETE VIDEO
exports.deleteVideo = async (req, res) => {
  try {
    const { noKayuBulat, noUrut } = req.params;

    const result = await kayuBulatService.deleteVideo({
      noKayuBulat,
      noUrut: parseInt(noUrut, 10),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Error delete video:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};




