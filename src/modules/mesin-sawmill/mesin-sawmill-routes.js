const express = require('express');
const verifyToken = require('../../core/middleware/verify-token');
const mesinSawmillController = require('./mesin-sawmill-controller');

const router = express.Router();
router.use(express.json());

// GET /mesin-sawmill?q=...&type=...&isSLP=1&isGroup=0&idGroupMesinSawmill=2
// Menampilkan HANYA yang Enable = 1 (aktif), tanpa pagination
router.get('/', verifyToken, mesinSawmillController.getAllEnabled);


module.exports = router;
