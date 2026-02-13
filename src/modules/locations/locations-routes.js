const express = require("express");
const verifyToken = require("../../core/middleware/verify-token");
const masterLokasiController = require("./locations-controller");

const router = express.Router();

// endpoint list (sementara tetap /mst-lokasi)
router.get("/mst-lokasi", verifyToken, masterLokasiController.getAllLokasi);

module.exports = router;
