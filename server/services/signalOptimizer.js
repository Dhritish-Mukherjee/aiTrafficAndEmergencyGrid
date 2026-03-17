const Junction = require('../models/Junction');
const { getIo } = require('../config/socket');

/**
 * Determines optimal green/red signal durations based on vehicle count.
 * @param {number} vehicleCount - Number of vehicles detected at the junction.
 * @returns {{ greenDuration: number, redDuration: number }}
 */
const computeSignalTiming = (vehicleCount) => {
  if (vehicleCount > 30) {
    return { greenDuration: 60, redDuration: 20 };
  } else if (vehicleCount >= 15) {
    return { greenDuration: 40, redDuration: 30 };
  } else {
    return { greenDuration: 25, redDuration: 45 };
  }
};

/**
 * Runs the signal optimizer for a given junction and its latest vehicle count.
 * - Computes optimal timing
 * - Persists the new timing to MongoDB
 * - Emits real-time events via Socket.io
 *
 * @param {Object} junction    - Mongoose Junction document
 * @param {number} vehicleCount
 * @param {Object} densityData - Full density payload (for the density:updated event)
 */
const optimizeSignal = async (junction, vehicleCount, densityData) => {
  try {
    const { greenDuration, redDuration } = computeSignalTiming(vehicleCount);

    // Skip update if junction is manually overridden by an operator
    if (junction.isOverridden) {
      return;
    }

    // Persist new timing to MongoDB
    junction.timing = greenDuration;
    await junction.save();

    const signalPayload = {
      junctionId: junction._id,
      junctionName: junction.name,
      greenDuration,
      redDuration,
      vehicleCount,
      timestamp: new Date(),
    };

    // Emit real-time updates via Socket.io
    try {
      const io = getIo();
      io.emit('signal:updated', signalPayload);
      io.emit('density:updated', { ...densityData, greenDuration, redDuration });
    } catch (err) {
      // Socket may not be initialized during startup, so silently skip
    }
  } catch (err) {
    console.error(`❌ Signal Optimizer error for junction ${junction.name}:`, err.message);
  }
};

module.exports = { computeSignalTiming, optimizeSignal };
