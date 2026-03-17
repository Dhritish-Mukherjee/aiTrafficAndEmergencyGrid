require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");

// ─── Connect to Database ──────────────────────────────────────────────────────
connectDB();

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 5000;

// ─── Routes ───────────────────────────────────────────────────────────────────
const junctionRouter = require('./routes/junctions');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/api/junctions', junctionRouter);

// ─── Health Check Route ───────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "🚦 AI Traffic & Emergency Grid server is running!",
    timestamp: new Date().toISOString(),
  });
});

// ─── Socket.IO Connection ─────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Client connected   → id: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected → id: ${socket.id}`);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log("─────────────────────────────────────────");
  console.log(`🚦  AI Traffic & Emergency Grid`);
  console.log(`✅  Server running on http://localhost:${PORT}`);
  console.log("─────────────────────────────────────────");
});
