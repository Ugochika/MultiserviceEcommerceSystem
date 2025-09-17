const express = require('express');
const router = express.Router();
const Customer = require('../models/customer');

// seed endpoint or initial seeding script
router.post('/', async (req, res) => {
  const { name, email } = req.body;
  try {
    const c = new Customer({ name, email });
    await c.save();
    res.status(201).json(c);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    res.json(c);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
