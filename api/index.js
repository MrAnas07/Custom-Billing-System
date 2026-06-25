const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) return;
  try {
    await mongoose.connect(MONGO_URI);
    isConnected = true;
    console.log('MongoDB Connected');
  } catch (err) {
    console.log('DB Error:', err.message);
  }
}

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

app.get('/api', (req, res) => {
  res.json({ status: 'AR Box API is running' });
});

const productRoutes = require('./routes/products');
const invoiceRoutes = require('./routes/invoices');
const clientRoutes = require('./routes/clients');

app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/clients', clientRoutes);

module.exports = app;
module.exports.handler = serverless(app);
