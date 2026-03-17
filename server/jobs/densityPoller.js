const cron = require('node-cron');
const redis = require('../config/redis');
const Junction = require('../models/Junction');
const TrafficLog = require('../models/TrafficLog');
const { getIo } = require('../config/socket');
const { optimizeSignal } = require('../services/signalOptimizer');
const { analyzeTrafficFrame, getDemoImageBase64 } = require('../services/aiClient');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

/**
 * Initializes a CRON job to run every 5 seconds.
 * It simulates an AI vision system processing live webcam feeds
 * and determining vehicle density at every junction.
 */
const startDensityPoller = () => {
  console.log('🕒 Density Poller initialized: Standing by to generate traffic data every 5 seconds.');

  // Run every 5 seconds
  cron.schedule('*/5 * * * * *', async () => {
    try {
      const junctions = await Junction.find({});
      
      if (!junctions || junctions.length === 0) {
        return; // No junctions in DB, nothing to do
      }

      // Read the test demo jpeg only once per cron tick so we don't spam disk I/O
      const demoImageStr = AI_SERVICE_URL !== 'mock' ? getDemoImageBase64() : null;
      const trafficLogsToInsert = [];

      // Run AI analytics concurrently across all junctions so it finishes within 5 secs
      await Promise.all(junctions.map(async (junction) => {
        let vehicleCount = null;

        if (AI_SERVICE_URL !== 'mock' && demoImageStr) {
          // Send camera frame to Python YOLO
          vehicleCount = await analyzeTrafficFrame(`cam_${junction._id}`, demoImageStr);
        }

        // Silent mock fallback logic (if Python offline, or mode=mock, or AI fails)
        if (vehicleCount === null) {
          vehicleCount = Math.floor(Math.random() * 51);
        }
        
        // Calculate abstract densityScore (out of 100) based on car count
        const densityScore = Math.min(Math.round((vehicleCount / 50) * 100), 100);
        
        // Determine categorical density level
        let densityLevel = 'LOW';
        if (vehicleCount > 40) densityLevel = 'SEVERE';
        else if (vehicleCount > 25) densityLevel = 'HIGH';
        else if (vehicleCount > 10) densityLevel = 'MODERATE';

        const trafficData = {
          junctionId: junction._id,
          vehicleCount,
          densityScore,
          densityLevel,
          timestamp: new Date()
        };

        // 1. Write the latest snapshot to Redis (setex = Set String with Expiration in seconds)
        await redis.setex(`junction:${junction._id}:density`, 30, JSON.stringify(trafficData));

        // 2. Run signal optimizer — updates MongoDB timing + emits socket events
        await optimizeSignal(junction, vehicleCount, trafficData);

        // Push data to local array for bulk mongodb insert later
        trafficLogsToInsert.push(trafficData);
      }));

      // 2. Perform a fast Bulk Insert to MongoDB for long-term historical records
      if (trafficLogsToInsert.length > 0) {
        await TrafficLog.insertMany(trafficLogsToInsert);
      }
      
      // 3. (Optional but helpful!) Broadcast this live data to the web dashboard instantly 
      try {
        const io = getIo();
        io.emit('traffic:live_density', trafficLogsToInsert);
      } catch (err) {
        // If the socket isn't ready yet, it will quietly skip
      }

      console.log(`🚦 Density Poller → Updated mock data for ${junctions.length} junctions.`);
    } catch (error) {
      console.error('❌ Error in Density Poller:', error.message);
    }
  });
};

module.exports = startDensityPoller;
