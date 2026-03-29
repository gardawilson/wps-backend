const express = require("express");
const verifyToken = require("../../core/middleware/verify-token");
const auditController = require("./audit-controller");

const router = express.Router();

router.use(express.json());
router.use(verifyToken);

router.get("/audit", auditController.getAuditList);
router.get("/audit/pk/:pkValue", auditController.getAuditByPkValue);
router.get("/audit/:auditId", auditController.getAuditDetail);

module.exports = router;
