const mongoose = require('mongoose');

const emergencyEventSchema = new mongoose.Schema({
  vehicleId: {
    type: String,
    required: true,
    trim: true,
  },
  origin: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  destination: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  corridorJunctions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Junction', // The path of junctions cleared for the emergency vehicle
  }],
  gpsPings: [{
    lat: { type: Number },
    lng: { type: Number },
    timestamp: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['ACTIVE', 'RESOLVED', 'FAILED'],
    default: 'ACTIVE',
  },
  responseTimeSecs: {
    type: Number,
    // Calculated when status changes to RESOLVED
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('EmergencyEvent', emergencyEventSchema);
