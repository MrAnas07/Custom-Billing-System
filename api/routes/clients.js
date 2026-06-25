const express = require('express');
const router = express.Router();
const { Client } = require('../models/Schemas');

router.post('/add', async (req, res) => {
  try {
    const { client_name, client_mobile } = req.body;
    const existingClient = await Client.findOne({ client_mobile });
    if (existingClient) {
      return res.status(400).json({ error: 'This mobile number is already registered!' });
    }
    const newClient = new Client({ client_name, client_mobile });
    await newClient.save();
    res.status(201).json({ message: 'Client registered successfully!', newClient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', async (req, res) => {
  try {
    const clients = await Client.find().sort({ client_name: 1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/delete/:id', async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
