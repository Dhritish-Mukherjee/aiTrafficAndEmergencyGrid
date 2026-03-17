require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const http = require("http");
const cors = require("cors");
const connectDB = require("./config/db");
const { initSocket } = require("./config/socket");

// ─── Connect to Database & Redis ────────────────────────────────────────────────
connectDB();
const redis = require('./config/redis');
// densityPoller is DISABLED — Python AI service now pushes density via
// POST /api/density/report every 5 seconds from real YOLO video analysis.
// const startDensityPoller = require('./jobs/densityPoller');
// startDensityPoller();

// ─── Redis Test ──────────────────────────────────────────────────────────────
(async () => {
  try {
    await redis.set('test', 'hello');
    const value = await redis.get('test');
    console.log(`📡 Redis Test result: expected "hello", got "${value}"`);
  } catch (err) {
    console.error('❌ Redis Test failed:', err.message);
  }
})();

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = initSocket(server);

const PORT = process.env.PORT || 5000;

// ─── Routes ───────────────────────────────────────────────────────────────────
const junctionRouter  = require('./routes/junctions');
const emergencyRouter = require('./routes/emergency');
const densityRouter   = require('./routes/density');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/api/junctions', junctionRouter);
app.use('/api/emergency', emergencyRouter);
app.use('/api/density',   densityRouter);

// ─── Health Check Route ───────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "🚦 AI Traffic & Emergency Grid server is running!",
    timestamp: new Date().toISOString(),
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log("─────────────────────────────────────────");
  console.log(`🚦  AI Traffic & Emergency Grid`);
  console.log(`✅  Server running on http://localhost:${PORT}`);
  console.log("─────────────────────────────────────────");
});
