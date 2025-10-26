const express = require('express');
const verifyToken = require('../../core/middleware/verify-token');
const jenisKayuController = require('./jenis-kayu-controller');

const router = express.Router();
router.use(express.json());

// GET /jenis-kayu?q=...&enable=1&idGroup=2&isLokal=1&isInternal=0&isUpah=0&isST=1&isNonST=0
router.get('/', verifyToken, jenisKayuController.getAll); // ⬅️ tanpa pagination

module.exports = router;
