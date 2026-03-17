const axios = require('axios');
const fs = require('fs');
const path = require('path');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

/**
 * Sends a base64 encoded image to the Python FastAPI service for YOLO analysis.
 * @param {string} cameraId 
 * @param {string} imageBase64 
 * @returns {number | null} - The vehicle count, or null if it fails.
 */
const analyzeTrafficFrame = async (cameraId, imageBase64) => {
  // Shortcut if explicitly configured for mock mode
  if (AI_SERVICE_URL === 'mock') {
    return null;
  }

  try {
    const response = await axios.post(`${AI_SERVICE_URL}/analyze`, {
      camera_id: cameraId,
      image_base64: imageBase64
    }, { timeout: 4000 }); // Fast fail so we don't stall the 5s cron loop
    
    return response.data.vehicle_count;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.warn(`⚠️ AI Service offline at ${AI_SERVICE_URL} - falling back to mock.`);
    } else {
      console.warn(`⚠️ AI Service error for ${cameraId}: ${error.message} - falling back to mock.`);
    }
    return null;
  }
};

/**
 * Utility to load the static test image for end-to-end demo purposes.
 * @returns {string | null}
 */
const getDemoImageBase64 = () => {
  try {
    // Navigate up from server/services to ai-service folder
    const imgPath = path.resolve(__dirname, '../../ai-service/output_35ba40457cd84f1991c5b86831dab355.jpg');
    if (fs.existsSync(imgPath)) {
      return fs.readFileSync(imgPath).toString('base64');
    }
    return null;
  } catch (err) {
    return null;
  }
};

module.exports = { analyzeTrafficFrame, getDemoImageBase64 };
