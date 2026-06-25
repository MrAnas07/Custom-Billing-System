const express = require('express');
const router = express.Router();
const { Product } = require('../models/Schemas');

router.post('/add', async (req, res) => {
  try {
    const { box_name, size_inches, price } = req.body;
    const newProduct = new Product({ box_name, size_inches, price });
    await newProduct.save();
    res.status(201).json({ message: 'Box added successfully', product: newProduct });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/delete/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Box deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/update/:id', async (req, res) => {
  try {
    const { box_name, size_inches, price } = req.body;
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { box_name, size_inches, price },
      { new: true }
    );
    res.json({ message: 'Box updated successfully', product: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
