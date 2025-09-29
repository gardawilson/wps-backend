const express = require('express');
const verifyToken = require('../../core/middleware/verify-token');
const kayuBulatController = require('./kayu-bulat-controller');
const upload = require('../../core/utils/upload-image');
const uploadVideo = require('../../core/utils/upload-video');

const compressImage = require('../../core/utils/compress-image');
const compressVideo = require('../../core/utils/compress-video');

const router = express.Router();

// Endpoint RESTful
router.get('/kayu-bulat', verifyToken, kayuBulatController.getAllKayuBulat);
router.get('/kayu-bulat/:noKayuBulat', verifyToken, kayuBulatController.getKayuBulatById);
router.post('/kayu-bulat', verifyToken, kayuBulatController.createKayuBulat);
router.put('/kayu-bulat/:noKayuBulat', verifyToken, kayuBulatController.updateKayuBulat);
router.delete('/kayu-bulat/:noKayuBulat', verifyToken, kayuBulatController.deleteKayuBulat);

// Upload & compress image
router.post(
  '/kayu-bulat/:noKayuBulat/upload-image',
  verifyToken,
  upload.single('image'),
  compressImage,
  kayuBulatController.uploadImage
);


// Upload video
router.post(
  '/kayu-bulat/:noKayuBulat/upload-video',
  verifyToken,
  uploadVideo.single('video'),
  compressVideo,
  kayuBulatController.uploadVideo
);


// Get attachments by NoKayuBulat
router.get(
  '/kayu-bulat/:noKayuBulat/attachments',
  verifyToken,
  kayuBulatController.getAttachments
);


// routes/kayu-bulat-routes.js
router.get('/kayu-bulat/videos/:fileName', kayuBulatController.streamVideo);


// Update data image tanpa upload file
router.put(
  '/kayu-bulat/:noKayuBulat/update-image',
  verifyToken,
  kayuBulatController.updateImageData
);

// Update data video tanpa upload file
router.put(
  '/kayu-bulat/:noKayuBulat/update-video',
  verifyToken,
  kayuBulatController.updateVideoData
);


// Hapus image by tier
router.delete(
  '/kayu-bulat/:noKayuBulat/delete-image/:tier',
  verifyToken,
  kayuBulatController.deleteImage
);

// Hapus video by noUrut
router.delete(
  '/kayu-bulat/:noKayuBulat/delete-video/:noUrut',
  verifyToken,
  kayuBulatController.deleteVideo
);


module.exports = router;
