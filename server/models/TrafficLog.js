const mongoose = require('mongoose');

const trafficLogSchema = new mongoose.Schema({
  junctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Junction',
    required: true,
  },
  vehicleCount: {
    type: Number,
    required: true,
    min: 0,
  },
  densityScore: {
    type: Number,
    required: true, // A calculated score representing traffic heaviness
  },
  densityLevel: {
    type: String,
    enum: ['LOW', 'MODERATE', 'HIGH', 'SEVERE'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// TTL index to automatically delete documents 30 days (2592000 seconds) after the timestamp
trafficLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('TrafficLog', trafficLogSchema);
