const express = require('express');
const verifyToken = require('../../core/middleware/verify-token');
const labelDataController = require('./label-data-controller');

const router = express.Router();

router.get('/label-data/:nolabel', verifyToken, labelDataController.getLabelData);

module.exports = router;
