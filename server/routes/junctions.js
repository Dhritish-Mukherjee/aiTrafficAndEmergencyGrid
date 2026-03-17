const express = require('express');
const router = express.Router();
const Junction = require('../models/Junction');

// @route   GET /api/junctions
// @desc    Get all junctions
// @access  Public
router.get('/', async (req, res) => {
  try {
    const junctions = await Junction.find().populate('neighbours', 'name location');
    res.json(junctions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/junctions/:id
// @desc    Get junction by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const junction = await Junction.findById(req.params.id).populate('neighbours', 'name location');
    
    if (!junction) {
      return res.status(404).json({ msg: 'Junction not found' });
    }
    
    res.json(junction);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Junction not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/junctions
// @desc    Create a new junction
// @access  Public
router.post('/', async (req, res) => {
  try {
    // You can add validation logic here (e.g., using express-validator)
    const newJunction = new Junction(req.body);
    const junction = await newJunction.save();
    
    res.status(201).json(junction);
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ msg: 'Error creating junction', error: err.message });
  }
});

// @route   PUT /api/junctions/:id
// @desc    Update a junction
// @access  Public
router.put('/:id', async (req, res) => {
  try {
    let junction = await Junction.findById(req.params.id);
    
    if (!junction) {
      return res.status(404).json({ msg: 'Junction not found' });
    }

    junction = await Junction.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true } // Return the updated document
    );

    res.json(junction);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Junction not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/junctions/:id
// @desc    Delete a junction
// @access  Public
router.delete('/:id', async (req, res) => {
  try {
    const junction = await Junction.findById(req.params.id);

    if (!junction) {
      return res.status(404).json({ msg: 'Junction not found' });
    }

    await junction.deleteOne();

    res.json({ msg: 'Junction removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Junction not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
