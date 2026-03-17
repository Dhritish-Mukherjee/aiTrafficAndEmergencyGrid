const Redis = require('ioredis');

// Extract Redis URI from environment variables or use default local instance
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';

const redis = new Redis(REDIS_URI, {
  // Pass the password independently if provided in .env
  password: process.env.REDIS_PASSWORD,
  
  // Retry strategy for handling connection failures with exponential backoff
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    console.log(`⏳ Retrying Redis connection in ${delay}ms... (Attempt ${times})`);
    return delay;
  },
  maxRetriesPerRequest: null, // Good practice for queues and robust handling
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('ready', () => {
  console.log('🔥 Redis is ready to receive commands');
});

redis.on('error', (err) => {
  console.error('❌ Redis Connection Error →', err.message);
});

redis.on('close', () => {
  console.warn('⚠️ Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('🔄 Reconnecting to Redis...');
});

module.exports = redis;
