const { sql, poolPromise } = require('../../core/config/db');
require('dotenv').config();
const getLocalIp = require('../../core/utils/get-local-ip');
const fs = require("fs");
const path = require("path");



// Ambil semua data
exports.getAll = async () => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  const result = await pool.request().query(`
    SELECT TOP 1000 
      NoKayuBulat, NoPlat, IdJenisKayu, IdSupplier, IdPengukuran, 
      NoTruk, JenisTruk, DateCreate, Pengurangan, DateUsage, 
      Suket, Approve, ApprovedBy, ApproveDate, IdTanah, IdSupplierAsalKayu
    FROM KayuBulat_h
    ORDER BY DateCreate DESC
  `);
  return result.recordset;
};

// Ambil berdasarkan ID
exports.getById = async (noKayuBulat) => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  const result = await pool.request()
    .input('NoKayuBulat', sql.VarChar, noKayuBulat)
    .query(`SELECT * FROM KayuBulat_h WHERE NoKayuBulat = @NoKayuBulat`);
  return result.recordset[0] || null;
};

// Tambah data baru
exports.create = async (data) => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  const query = `
    INSERT INTO KayuBulat_h
      (NoKayuBulat, NoPlat, IdJenisKayu, IdSupplier, IdPengukuran, NoTruk, JenisTruk, DateCreate, Pengurangan, DateUsage, Suket, Approve, ApprovedBy, ApproveDate, IdTanah, IdSupplierAsalKayu)
    VALUES
      (@NoKayuBulat, @NoPlat, @IdJenisKayu, @IdSupplier, @IdPengukuran, @NoTruk, @JenisTruk, GETDATE(), @Pengurangan, @DateUsage, @Suket, @Approve, @ApprovedBy, @ApproveDate, @IdTanah, @IdSupplierAsalKayu)
  `;
  await pool.request()
    .input('NoKayuBulat', sql.VarChar, data.NoKayuBulat)
    .input('NoPlat', sql.VarChar, data.NoPlat)
    .input('IdJenisKayu', sql.Int, data.IdJenisKayu)
    .input('IdSupplier', sql.Int, data.IdSupplier)
    .input('IdPengukuran', sql.Int, data.IdPengukuran)
    .input('NoTruk', sql.VarChar, data.NoTruk)
    .input('JenisTruk', sql.VarChar, data.JenisTruk)
    .input('Pengurangan', sql.Decimal, data.Pengurangan)
    .input('DateUsage', sql.DateTime, data.DateUsage)
    .input('Suket', sql.VarChar, data.Suket)
    .input('Approve', sql.Bit, data.Approve)
    .input('ApprovedBy', sql.VarChar, data.ApprovedBy)
    .input('ApproveDate', sql.DateTime, data.ApproveDate)
    .input('IdTanah', sql.Int, data.IdTanah)
    .input('IdSupplierAsalKayu', sql.Int, data.IdSupplierAsalKayu)
    .query(query);

  return data;
};

// Update data
exports.update = async (noKayuBulat, data) => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  const result = await pool.request()
    .input('NoKayuBulat', sql.VarChar, noKayuBulat)
    .input('NoPlat', sql.VarChar, data.NoPlat)
    .input('IdJenisKayu', sql.Int, data.IdJenisKayu)
    .input('IdSupplier', sql.Int, data.IdSupplier)
    .input('IdPengukuran', sql.Int, data.IdPengukuran)
    .input('NoTruk', sql.VarChar, data.NoTruk)
    .input('JenisTruk', sql.VarChar, data.JenisTruk)
    .input('Pengurangan', sql.Decimal, data.Pengurangan)
    .input('DateUsage', sql.DateTime, data.DateUsage)
    .input('Suket', sql.VarChar, data.Suket)
    .input('Approve', sql.Bit, data.Approve)
    .input('ApprovedBy', sql.VarChar, data.ApprovedBy)
    .input('ApproveDate', sql.DateTime, data.ApproveDate)
    .input('IdTanah', sql.Int, data.IdTanah)
    .input('IdSupplierAsalKayu', sql.Int, data.IdSupplierAsalKayu)
    .query(`
      UPDATE KayuBulat_h
      SET NoPlat=@NoPlat, IdJenisKayu=@IdJenisKayu, IdSupplier=@IdSupplier, 
          IdPengukuran=@IdPengukuran, NoTruk=@NoTruk, JenisTruk=@JenisTruk, 
          Pengurangan=@Pengurangan, DateUsage=@DateUsage, Suket=@Suket, 
          Approve=@Approve, ApprovedBy=@ApprovedBy, ApproveDate=@ApproveDate, 
          IdTanah=@IdTanah, IdSupplierAsalKayu=@IdSupplierAsalKayu
      WHERE NoKayuBulat=@NoKayuBulat
    `);
  return result.rowsAffected[0] > 0;
};

// Hapus data
exports.remove = async (noKayuBulat) => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  const result = await pool.request()
    .input('NoKayuBulat', sql.VarChar, noKayuBulat)
    .query(`DELETE FROM KayuBulat_h WHERE NoKayuBulat=@NoKayuBulat`);
  return result.rowsAffected[0] > 0;
};


// Save image
// Save or replace image
exports.saveImage = async ({ noKayuBulat, tier, imageName, pcs }) => {
  const pool = await poolPromise;  // ← gunakan poolPromise

  // 1. Cari file lama kalau ada
  const oldFile = await pool.request()
    .input("NoKayuBulat", sql.VarChar, noKayuBulat)
    .input("Tier", sql.Int, tier)
    .query(`
      SELECT ImageName 
      FROM KayuBulat_dTier
      WHERE NoKayuBulat = @NoKayuBulat AND Tier = @Tier
    `);

  const oldFileName = oldFile.recordset[0]?.ImageName;

  // 2. Upsert (replace data)
  await pool.request()
    .input("NoKayuBulat", sql.VarChar, noKayuBulat)
    .input("Tier", sql.Int, tier)
    .input("ImageName", sql.VarChar, imageName)
    .input("Pcs", sql.Int, pcs)
    .query(`
      MERGE KayuBulat_dTier AS target
      USING (SELECT @NoKayuBulat AS NoKayuBulat, @Tier AS Tier) AS source
      ON target.NoKayuBulat = source.NoKayuBulat AND target.Tier = source.Tier
      WHEN MATCHED THEN
        UPDATE SET ImageName = @ImageName, Pcs = @Pcs
      WHEN NOT MATCHED THEN
        INSERT (NoKayuBulat, Tier, ImageName, Pcs)
        VALUES (@NoKayuBulat, @Tier, @ImageName, @Pcs);
    `);

  // 3. Hapus file lama (kalau ada dan beda nama)
  if (oldFileName && oldFileName !== imageName) {
    const filePath = path.join(__dirname, "../../../storage/kayu-bulat/images", oldFileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};



// Save video
exports.saveVideo = async ({ noKayuBulat, noUrut, videoName, remark, videoThumbnail }) => {
  const pool = await poolPromise;  // ← gunakan poolPromise

  // 1. Cari file lama kalau ada
  const oldFile = await pool.request()
    .input("NoKayuBulat", sql.VarChar, noKayuBulat)
    .input("NoUrut", sql.Int, noUrut)
    .query(`
      SELECT VideoName, VideoThumbnailName 
      FROM KayuBulat_dVideo
      WHERE NoKayuBulat = @NoKayuBulat AND NoUrut = @NoUrut
    `);

  const oldVideo = oldFile.recordset[0]?.VideoName;
  const oldThumb = oldFile.recordset[0]?.VideoThumbnailName;

  // 2. Upsert (replace data)
  await pool.request()
    .input("NoKayuBulat", sql.VarChar, noKayuBulat)
    .input("NoUrut", sql.Int, noUrut)
    .input("VideoName", sql.VarChar, videoName)
    .input("Remark", sql.NVarChar, remark || "")
    .input("VideoThumbnailName", sql.VarChar, videoThumbnail || null)
    .query(`
      MERGE KayuBulat_dVideo AS target
      USING (SELECT @NoKayuBulat AS NoKayuBulat, @NoUrut AS NoUrut) AS source
      ON target.NoKayuBulat = source.NoKayuBulat AND target.NoUrut = source.NoUrut
      WHEN MATCHED THEN
        UPDATE SET VideoName = @VideoName, Remark = @Remark, VideoThumbnailName = @VideoThumbnailName
      WHEN NOT MATCHED THEN
        INSERT (NoKayuBulat, NoUrut, VideoName, Remark, VideoThumbnailName)
        VALUES (@NoKayuBulat, @NoUrut, @VideoName, @Remark, @VideoThumbnailName);
    `);

  // 3. Hapus file lama (kalau ada dan beda nama)
  if (oldVideo && oldVideo !== videoName) {
    const videoPath = path.join(__dirname, "../../../storage/kayu-bulat/videos", oldVideo);
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
  }

  if (oldThumb && oldThumb !== videoThumbnail) {
    const thumbPath = path.join(__dirname, "../../../storage/kayu-bulat/videos/thumbs", oldThumb);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }
};




// Ambil semua attachment berdasarkan NoKayuBulat
exports.getAttachments = async (noKayuBulat) => {
  const pool = await poolPromise;  // ← gunakan poolPromise

  // Ambil gambar
  const resultImages = await pool.request()
    .input('NoKayuBulat', sql.VarChar, noKayuBulat)
    .query(`
      SELECT Tier, Pcs, ImageName
      FROM KayuBulat_dTier
      WHERE NoKayuBulat = @NoKayuBulat
      ORDER BY Tier ASC
    `);

  // Ambil video
  const resultVideos = await pool.request()
    .input('NoKayuBulat', sql.VarChar, noKayuBulat)
    .query(`
      SELECT NoUrut, VideoName, Remark, VideoThumbnailName
      FROM KayuBulat_dVideo
      WHERE NoKayuBulat = @NoKayuBulat
      ORDER BY NoUrut ASC
    `);

  const host = getLocalIp();               // ambil IP LAN otomatis
  const port = process.env.PORT || 5002;   // ambil dari env
  const baseUrl = `http://${host}:${port}`;

  return {
    images: resultImages.recordset.map(row => ({
      tier: row.Tier,
      pcs: row.Pcs,
      imageName: row.ImageName,
      imageUrl: `${baseUrl}/storage/kayu-bulat/images/${row.ImageName}`,
    })),
    videos: resultVideos.recordset.map(row => ({
      noUrut: row.NoUrut,
      videoName: row.VideoName,
      remark: row.Remark,
      videoUrl: `${baseUrl}/storage/kayu-bulat/videos/${row.VideoName}`,
      thumbnailUrl: row.VideoThumbnailName
        ? `${baseUrl}/storage/kayu-bulat/videos/thumbs/${row.VideoThumbnailName}`
        : null,
    }))
  };
};



// Update image data tanpa FILE
exports.updateImageData = async ({ noKayuBulat, tier, pcs, note }) => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  await pool.request()
    .input('NoKayuBulat', sql.VarChar, noKayuBulat)
    .input('Tier', sql.Int, tier)
    .input('Pcs', sql.Int, pcs)
    .query(`
      UPDATE KayuBulat_dTier
      SET Pcs = @Pcs
      WHERE NoKayuBulat = @NoKayuBulat AND Tier = @Tier
    `);
};

// Update video data tanpa file
exports.updateVideoData = async ({ noKayuBulat, noUrut, remark }) => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  await pool.request()
    .input('NoKayuBulat', sql.VarChar, noKayuBulat)
    .input('NoUrut', sql.Int, noUrut)
    .input('Remark', sql.NVarChar, remark || '')
    .query(`
      UPDATE KayuBulat_dVideo
      SET Remark = @Remark
      WHERE NoKayuBulat = @NoKayuBulat AND NoUrut = @NoUrut
    `);
};


// DELETE IMAGE
exports.deleteImage = async ({ noKayuBulat, tier }) => {
  const pool = await poolPromise;  // ← gunakan poolPromise
  const result = await pool.request()
    .input("NoKayuBulat", sql.VarChar, noKayuBulat)
    .input("Tier", sql.Int, tier)
    .query(`SELECT ImageName FROM KayuBulat_dTier WHERE NoKayuBulat=@NoKayuBulat AND Tier=@Tier`);

  const fileName = result.recordset[0]?.ImageName;

  await pool.request()
    .input("NoKayuBulat", sql.VarChar, noKayuBulat)
    .input("Tier", sql.Int, tier)
    .query(`DELETE FROM KayuBulat_dTier WHERE NoKayuBulat=@NoKayuBulat AND Tier=@Tier`);

  if (fileName) {
    const filePath = path.join(__dirname, "../../../storage/kayu-bulat/images", fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  return { message: `Image tier ${tier} berhasil dihapus`, data: { noKayuBulat, tier, fileName } };
};


// DELETE VIDEO
exports.deleteVideo = async ({ noKayuBulat, noUrut }) => {
  const pool = await poolPromise;  // ← gunakan poolPromise

  // 1. Ambil nama file & thumbnail
  const result = await pool.request()
    .input("NoKayuBulat", sql.VarChar, noKayuBulat)
    .input("NoUrut", sql.Int, noUrut)
    .query(`
      SELECT VideoName, VideoThumbnailName 
      FROM KayuBulat_dVideo
      WHERE NoKayuBulat = @NoKayuBulat AND NoUrut = @NoUrut
    `);

  const fileName = result.recordset[0]?.VideoName;
  const thumbName = result.recordset[0]?.VideoThumbnailName;

  // 2. Hapus record di DB
  await pool.request()
    .input("NoKayuBulat", sql.VarChar, noKayuBulat)
    .input("NoUrut", sql.Int, noUrut)
    .query(`
      DELETE FROM KayuBulat_dVideo
      WHERE NoKayuBulat = @NoKayuBulat AND NoUrut = @NoUrut
    `);

  // 3. Hapus file fisik video
  if (fileName) {
    const filePath = path.join(__dirname, "../../../storage/kayu-bulat/videos", fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  // 4. Hapus file thumbnail
  if (thumbName) {
    const thumbPath = path.join(__dirname, "../../../storage/kayu-bulat/videos/thumbs", thumbName);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  return {
    message: `Video noUrut ${noUrut} berhasil dihapus`,
    data: { noKayuBulat, noUrut, fileName, thumbName },
  };
};