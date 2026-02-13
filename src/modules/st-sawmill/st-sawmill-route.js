const express = require("express");
const verifyToken = require("../../core/middleware/verify-token");
const controller = require("./st-sawmill-controller");

const router = express.Router();

/**
 * GET /st-sawmill/produk-spk
 * Query params:
 *  - Tebal (required)
 *  - Lebar (required)
 *  - IdJenisKayu (required)
 */
router.get("/produk-spk", verifyToken, controller.getProdukSpk);

/**
 * GET /st-sawmill/sisa-ton
 * Query params:
 *  - NoSPK (required)
 *  - IdProdukSPK (required)
 */
router.get("/sisa-ton", verifyToken, controller.getSisaTon);

module.exports = router;
