const express = require('express');
const router = express.Router();
const EmergencyEvent = require('../models/EmergencyEvent');
const Junction = require('../models/Junction');
const { planCorridor } = require('../services/corridorPlanner');
const { getIo } = require('../config/socket');

// ─── POST /api/emergency/activate ────────────────────────────────────────────
// Body: { vehicleId, origin: {lat,lng}, destination: {lat,lng} }
// 1. Runs A* to find corridor path
// 2. Saves an EmergencyEvent document
// 3. Overrides each junction in sequence with a staggered green wave
// 4. Emits 'emergency:activated'
router.post('/activate', async (req, res) => {
  try {
    const { vehicleId, origin, destination } = req.body;

    if (!vehicleId || !origin || !destination) {
      return res.status(400).json({ msg: 'vehicleId, origin, and destination are required.' });
    }

    // 1. Plan the corridor via A*
    const { path, junctions } = await planCorridor(origin, destination);

    // 2. Create and save the EmergencyEvent
    const event = await EmergencyEvent.create({
      vehicleId,
      origin,
      destination,
      corridorJunctions: path,
      gpsPings: [{ lat: origin.lat, lng: origin.lng }],
      status: 'ACTIVE',
    });

    // 3. Staggered green wave — each junction activates T + (i * 8000ms)
    junctions.forEach((junction, i) => {
      setTimeout(async () => {
        try {
          await Junction.findByIdAndUpdate(junction._id, {
            isOverridden: true,
            timing: 90, // Extended green for emergency
          });

          getIo().emit('emergency:junction:green', {
            eventId: event._id,
            junctionId: junction._id,
            junctionName: junction.name,
            index: i,
            total: junctions.length,
          });
        } catch (err) {
          console.error(`❌ Failed to override junction ${junction.name}:`, err.message);
        }
      }, i * 8000);
    });

    // 4. Notify all clients immediately
    getIo().emit('emergency:activated', {
      eventId: event._id,
      vehicleId,
      origin,
      destination,
      corridorJunctions: path,
      junctionNames: junctions.map((j) => j.name),
      totalJunctions: junctions.length,
    });

    res.status(201).json({
      msg: '🚨 Emergency corridor activated!',
      eventId: event._id,
      corridorJunctions: path,
      junctionNames: junctions.map((j) => j.name),
    });
  } catch (err) {
    console.error('❌ /activate error:', err.message);
    res.status(500).json({ msg: 'Failed to activate emergency corridor.', error: err.message });
  }
});

// ─── POST /api/emergency/location ────────────────────────────────────────────
// Body: { eventId, lat, lng }
// Pushes a GPS ping to the EmergencyEvent and emits 'emergency:location'
router.post('/location', async (req, res) => {
  try {
    const { eventId, lat, lng } = req.body;

    if (!eventId || lat === undefined || lng === undefined) {
      return res.status(400).json({ msg: 'eventId, lat, and lng are required.' });
    }

    const event = await EmergencyEvent.findByIdAndUpdate(
      eventId,
      { $push: { gpsPings: { lat, lng, timestamp: new Date() } } },
      { new: true }
    );

    if (!event) return res.status(404).json({ msg: 'Emergency event not found.' });

    getIo().emit('emergency:location', {
      eventId,
      lat,
      lng,
      timestamp: new Date(),
    });

    res.json({ msg: 'GPS ping recorded.', pings: event.gpsPings.length });
  } catch (err) {
    console.error('❌ /location error:', err.message);
    res.status(500).json({ msg: 'Failed to record location.', error: err.message });
  }
});

// ─── POST /api/emergency/deactivate ──────────────────────────────────────────
// Body: { eventId }
// Restores all overridden junctions, sets responseTimeSecs, emits 'emergency:cleared'
router.post('/deactivate', async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({ msg: 'eventId is required.' });
    }

    const event = await EmergencyEvent.findById(eventId);
    if (!event) return res.status(404).json({ msg: 'Emergency event not found.' });
    if (event.status !== 'ACTIVE') {
      return res.status(400).json({ msg: `Event is already ${event.status}.` });
    }

    // Restore all corridor junctions — remove override
    await Junction.updateMany(
      { _id: { $in: event.corridorJunctions } },
      { $set: { isOverridden: false } }
    );

    // Calculate response time in seconds
    const responseTimeSecs = Math.round(
      (Date.now() - new Date(event.createdAt).getTime()) / 1000
    );

    // Update event to RESOLVED
    event.status = 'RESOLVED';
    event.responseTimeSecs = responseTimeSecs;
    await event.save();

    getIo().emit('emergency:cleared', {
      eventId: event._id,
      vehicleId: event.vehicleId,
      corridorJunctions: event.corridorJunctions,
      responseTimeSecs,
    });

    res.json({
      msg: '✅ Emergency corridor cleared.',
      responseTimeSecs,
    });
  } catch (err) {
    console.error('❌ /deactivate error:', err.message);
    res.status(500).json({ msg: 'Failed to deactivate corridor.', error: err.message });
  }
});

// ─── GET /api/emergency/active ────────────────────────────────────────────────
// Returns all currently ACTIVE emergency events
router.get('/active', async (req, res) => {
  try {
    const events = await EmergencyEvent.find({ status: 'ACTIVE' })
      .populate('corridorJunctions', 'name location')
      .sort({ createdAt: -1 });

    res.json(events);
  } catch (err) {
    console.error('❌ /active error:', err.message);
    res.status(500).json({ msg: 'Failed to fetch active emergencies.', error: err.message });
  }
});

module.exports = router;
