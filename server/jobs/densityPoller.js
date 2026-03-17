const cron = require('node-cron');
const redis = require('../config/redis');
const Junction = require('../models/Junction');
const TrafficLog = require('../models/TrafficLog');
const { getIo } = require('../config/socket');
const { optimizeSignal } = require('../services/signalOptimizer');

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

      const trafficLogsToInsert = [];

      for (const junction of junctions) {
        // Generate random vehicle count between 0 and 50
        const vehicleCount = Math.floor(Math.random() * 51);
        
        // Calculate abstract densityScore (out of 100) based on car count
        const densityScore = Math.round((vehicleCount / 50) * 100);
        
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
        // Set TTL to 30 seconds. This ensures stale data is cleared automatically if the poller dies.
        await redis.setex(`junction:${junction._id}:density`, 30, JSON.stringify(trafficData));

        // 2. Run signal optimizer — updates MongoDB timing + emits socket events
        await optimizeSignal(junction, vehicleCount, trafficData);

        trafficLogsToInsert.push(trafficData);
      }

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
