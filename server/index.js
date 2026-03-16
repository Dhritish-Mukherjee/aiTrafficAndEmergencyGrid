import "dotenv/config";
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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
