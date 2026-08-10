const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const kycDashboardRoutes = require('./kycDashboardRoutes');

const app = express();

const corsOptions = {
  origin: [
    "https://main.d1dkc4fsrg2g8d.amplifyapp.com",
    "http://localhost:3000",
    "http://localhost:8080"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Ensure OPTIONS requests are resolved immediately with 204
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", "https://main.d1dkc4fsrg2g8d.amplifyapp.com");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return res.status(204).end();
  }
  next();
});

// Explicitly set CORS headers for all responses to ensure Lambda includes them
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://main.d1dkc4fsrg2g8d.amplifyapp.com");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ message: 'KYC Operations Dashboard API is running' });
});

app.use('/admin/kyc-dashboard', kycDashboardRoutes);

module.exports.handler = serverless(app);
