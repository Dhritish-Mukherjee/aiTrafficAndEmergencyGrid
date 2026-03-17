const mongoose = require('mongoose');

const junctionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Junction name is required'],
    trim: true,
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  laneCount: {
    type: Number,
    required: true,
    min: 1,
  },
  neighbours: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Junction',
  }],
  currentPhase: {
    type: Number,
    default: 0, // Current active signal group/lane
  },
  timing: {
    type: Number,
    default: 30, // Current duration in seconds for the phase
  },
  isOverridden: {
    type: Boolean,
    default: false, // For emergency grid or manual override
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Junction', junctionSchema);
