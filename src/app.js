const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Import routes
const authRoutes = require('./modules/auth/auth-routes');
const stockOpnameRoutes = require('./modules/stock-opname/stock-opname-routes');
const labelDataRoutes = require('./modules/label-data/label-data-routes');
const profileRoutes = require('./modules/profile/profile-routes');
const mappingRoutes = require('./modules/mapping/mapping-routes');
const nyangkutRoutes = require('./modules/nyangkut/nyangkut-routes');
const mstLokasiRoutes = require('./modules/locations/locations-routes');
const bongkarKdRoutes = require('./modules/bongkar-kd/bongkar-kd-routes');
const kayuBulatRoutes = require('./modules/kayu-bulat/kayu-bulat-routes');
const qcSawmill = require('./modules/qc-sawmill/qc-sawmill-routes');
const jenisKayu = require('./modules/jenis-kayu/jenis-kayu-routes');
const mesinSawmill = require('./modules/mesin-sawmill/mesin-sawmill-routes');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

// Static folder
app.use(
  '/storage/kayu-bulat',
  express.static(path.join(__dirname, '../storage/kayu-bulat'))
);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api', stockOpnameRoutes);
app.use('/api', labelDataRoutes);
app.use('/api', profileRoutes);
app.use('/api', mappingRoutes);
app.use('/api', nyangkutRoutes);
app.use('/api', mstLokasiRoutes);
app.use('/api', bongkarKdRoutes);
app.use('/api', kayuBulatRoutes);
app.use('/api/qc-sawmill', qcSawmill);
app.use('/api/jenis-kayu', jenisKayu);
app.use('/api/mesin-sawmill', mesinSawmill);

module.exports = app;
