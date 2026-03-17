const express = require('express');
const router  = express.Router();
const redis   = require('../config/redis');
const Junction    = require('../models/Junction');
const TrafficLog  = require('../models/TrafficLog');
const { getIo }   = require('../config/socket');
const { optimizeSignal } = require('../services/signalOptimizer');

/**
 * POST /api/density/report
 * Called by the Python AI service every 5 seconds with real YOLO counts.
 *
 * Body: {
 *   junctionId:   string,
 *   vehicleCount: number,
 *   densityScore: number,
 *   densityLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE',
 *   classes:      { car: number, bus: number, ... }   (optional)
 * }
 */
router.post('/report', async (req, res) => {
  try {
    const { junctionId, vehicleCount, densityScore, densityLevel, classes } = req.body;

    if (!junctionId || vehicleCount === undefined) {
      return res.status(400).json({ msg: 'junctionId and vehicleCount are required.' });
    }

    const junction = await Junction.findById(junctionId);
    if (!junction) {
      return res.status(404).json({ msg: `Junction ${junctionId} not found.` });
    }

    const trafficData = {
      junctionId,
      vehicleCount,
      densityScore:  densityScore  ?? Math.min(Math.round((vehicleCount / 50) * 100), 100),
      densityLevel:  densityLevel  ?? computeLevel(vehicleCount),
      classes:       classes       ?? {},
      timestamp:     new Date(),
    };

    // 1. Cache latest snapshot in Redis (30 second TTL)
    await redis.setex(
      `junction:${junctionId}:density`,
      30,
      JSON.stringify(trafficData)
    );

    // 2. Run signal optimizer → persists timing to Mongo + emits socket events
    await optimizeSignal(junction, vehicleCount, trafficData);

    // 3. Persist to TrafficLog for historical records
    await TrafficLog.create(trafficData);

    // 4. Broadcast enriched density payload to all dashboard clients
    try {
      const io = getIo();
      io.emit('traffic:live_density', [trafficData]);
    } catch (_) { /* socket may not be ready */ }

    return res.json({ status: 'ok', junctionId, vehicleCount, densityLevel: trafficData.densityLevel });
  } catch (err) {
    console.error('❌ /api/density/report error:', err.message);
    res.status(500).json({ msg: 'Internal error', error: err.message });
  }
});

/**
 * GET /api/density/:junctionId
 * Returns latest density snapshot for a junction (from Redis cache).
 */
router.get('/:junctionId', async (req, res) => {
  try {
    const cached = await redis.get(`junction:${req.params.junctionId}:density`);
    if (!cached) {
      return res.status(404).json({ msg: 'No density data cached yet for this junction.' });
    }
    res.json(JSON.parse(cached));
  } catch (err) {
    console.error('❌ /api/density/:id error:', err.message);
    res.status(500).json({ msg: 'Internal error' });
  }
});

function computeLevel(count) {
  if (count > 40) return 'SEVERE';
  if (count > 25) return 'HIGH';
  if (count > 10) return 'MODERATE';
  return 'LOW';
}

module.exports = router;
