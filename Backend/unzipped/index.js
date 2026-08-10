const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const kycDashboardRoutes = require('./kycDashboardRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ message: 'KYC Operations Dashboard API is running' });
});

app.use('/admin/kyc-dashboard', kycDashboardRoutes);

module.exports.handler = serverless(app);
