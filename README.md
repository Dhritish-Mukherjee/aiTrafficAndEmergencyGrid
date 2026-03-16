# TrafficAI — Dynamic Traffic Flow Optimizer & Emergency Grid
### National Hackathon Project · Full Planning Document

> **Stack:** MERN (MongoDB, Express, React, Node.js) + Python AI Microservice + Redis + Socket.IO  
> **Team:** Keep this file at the root of your project repo.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Folder Structure](#3-folder-structure)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [Socket.IO Events](#6-socketio-events)
7. [Environment Variables](#7-environment-variables)
8. [Hosting & Deployment](#8-hosting--deployment)
9. [Build Phases](#9-build-phases)
10. [Hackathon Presentation Tips](#10-hackathon-presentation-tips)

---

## 1. Project Overview

### What It Does
**TrafficAI** is a real-time intelligent traffic management system with two core features:

| Feature | What it does |
|---|---|
| **Dynamic Signal Optimizer** | Uses computer vision to count vehicles at each junction every 5 seconds and automatically adjusts green/red light durations based on live density |
| **Emergency Green Corridor** | When an ambulance or fire truck activates the system, it instantly plans the fastest route and forces all traffic lights along that route to green — clearing the road ahead |

### Why It Wins Hackathons
- Solves a **real, national-scale problem** (traffic congestion + emergency response time)
- Has a **live, visual demo** (map with animated signals and emergency corridor)
- Uses **AI/ML** (computer vision) in a way that's explainable to judges
- **Full-stack** with real-time features (Socket.IO)

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React Dashboard                       │
│         (Leaflet Map + Signal Grid + Emergency Panel)        │
└──────────────────────┬──────────────────────────────────────┘
                       │  HTTP (axios) + WebSocket (Socket.IO)
┌──────────────────────▼──────────────────────────────────────┐
│                  Node.js + Express Server                    │
│   Routes │ Socket.IO │ Services │ Redis Cache │ Cron Jobs   │
└─────┬──────────────────────────────────────┬────────────────┘
      │ Mongoose                             │ axios (internal)
┌─────▼──────────┐                 ┌─────────▼────────────────┐
│   MongoDB       │                 │   Python FastAPI Service  │
│  (persistent)   │                 │   (YOLO CV + AI logic)   │
└─────────────────┘                 └──────────────────────────┘
      ▲
┌─────┴──────────┐
│  Redis Cache    │
│ (live density)  │
└─────────────────┘
```

### Data Flow — Normal Operation
```
Camera Frame
    → Python /analyze
        → vehicle count + density score
            → POST /api/density/report (to Node)
                → saved to Redis (instant)
                → saved to MongoDB (historical)
                → Node recalculates signal timings
                    → Socket.IO emit: signal:updated
                        → React map updates signal colour
```

### Data Flow — Emergency Corridor
```
Ambulance GPS ping
    → POST /api/emergency/activate (to Node)
        → corridorPlanner.js calculates route
            → POST /api/signals/:id/override for each junction
                → Socket.IO emit: emergency:activated
                    → React highlights corridor in red on map
                        → every 2s: POST /api/emergency/location
                            → Socket.IO emit: emergency:location
                                → React animates vehicle marker moving
```

---

## 3. Folder Structure

```
trafficai/                          ← root of your repo
│
├── PLANNING.md                     ← this file
├── README.md
├── .env                            ← never commit this
├── .env.example                    ← commit this (no real secrets)
├── .gitignore
├── docker-compose.yml              ← spins up all services locally
│
├── server/                         ← Node.js + Express backend
│   ├── index.js                    ← entry point, starts server
│   │
│   ├── config/
│   │   ├── db.js                   ← mongoose.connect()
│   │   ├── redis.js                ← ioredis client setup
│   │   └── socket.js               ← socket.io server setup + event registry
│   │
│   ├── models/
│   │   ├── Junction.js             ← junction config + current state
│   │   ├── TrafficLog.js           ← density readings (written every 5s)
│   │   └── EmergencyEvent.js       ← emergency corridor records
│   │
│   ├── routes/
│   │   ├── junctions.js            ← GET/POST/PUT junction CRUD
│   │   ├── signals.js              ← signal phase control + override
│   │   ├── density.js              ← density reporting + history
│   │   ├── emergency.js            ← corridor activation + GPS pings
│   │   └── analytics.js            ← summary stats + emergency log
│   │
│   ├── services/
│   │   ├── corridorPlanner.js      ← calculates green corridor route (A* / Dijkstra)
│   │   ├── signalOptimizer.js      ← Webster formula + AI timing recommendations
│   │   └── aiClient.js             ← axios calls to Python FastAPI service
│   │
│   ├── middleware/
│   │   ├── auth.js                 ← JWT verify middleware
│   │   └── errorHandler.js         ← global error handler
│   │
│   └── jobs/
│       └── densityPoller.js        ← node-cron: calls AI service every 5s per junction
│
├── client/                         ← React frontend (Vite)
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       │
│       ├── pages/
│       │   ├── Dashboard.jsx       ← main ops view: map + signal grid + emergency panel
│       │   └── Analytics.jsx       ← charts: historical density, response times
│       │
│       ├── components/
│       │   ├── TrafficMap.jsx      ← Leaflet map with junction markers + corridor overlay
│       │   ├── SignalGrid.jsx      ← grid of all junctions showing current phase
│       │   ├── EmergencyPanel.jsx  ← active corridors list + activate button
│       │   └── StatsBar.jsx        ← top bar: total vehicles, active junctions, alerts
│       │
│       ├── hooks/
│       │   ├── useSocket.js        ← connects to socket.io, handles all events
│       │   └── useJunctions.js     ← fetches + caches junction data
│       │
│       └── api/
│           └── index.js            ← all axios calls in one place
│
└── ai-service/                     ← Python FastAPI microservice
    ├── main.py                     ← FastAPI app, route definitions
    ├── detector.py                 ← YOLOv8 wrapper: takes frame → returns count
    ├── optimizer.py                ← signal timing calculator (Webster formula)
    ├── requirements.txt
    ├── Dockerfile
    └── models/
        └── yolov8n.pt              ← pretrained model (download separately, gitignore)
```

---

## 4. Database Schema

### Junction
```js
// models/Junction.js
{
  _id: ObjectId,
  name: String,                  // e.g. "Junction A1 - MG Road"
  location: {
    lat: Number,
    lng: Number
  },
  laneCount: Number,             // total lanes (affects timing weight)
  currentPhase: {
    type: String,                // "green" | "red" | "yellow" | "emergency"
    direction: String            // "NS" | "EW" (north-south / east-west)
  },
  timing: {
    greenDuration: Number,       // seconds (dynamically updated by optimizer)
    redDuration: Number,
    yellowDuration: Number       // fixed at 3s
  },
  isOverridden: Boolean,         // true during emergency
  overriddenUntil: Date,
  createdAt: Date
}
```

### TrafficLog
```js
// models/TrafficLog.js
// Written every 5 seconds by the density poller — will grow fast, index on timestamp
{
  _id: ObjectId,
  junctionId: ObjectId,          // ref: Junction
  vehicleCount: Number,          // from YOLO detection
  densityScore: Number,          // 0-100 calculated score
  densityLevel: String,          // "low" | "medium" | "high" | "critical"
  signalPhaseAtTime: String,     // what the light was doing at this moment
  timestamp: Date                // INDEX THIS
}
```

### EmergencyEvent
```js
// models/EmergencyEvent.js
{
  _id: ObjectId,
  vehicleId: String,             // ambulance / fire truck ID
  vehicleType: String,           // "ambulance" | "fire" | "police"
  origin: { lat: Number, lng: Number },
  destination: { lat: Number, lng: Number },
  destinationName: String,       // e.g. "City Hospital"
  corridorJunctions: [ObjectId], // ordered list of junctions to preempt
  status: String,                // "active" | "cleared" | "completed"
  activatedAt: Date,
  clearedAt: Date,
  responseTimeSecs: Number,      // clearedAt - activatedAt
  gpsPings: [{                   // stored for replay / analytics
    lat: Number,
    lng: Number,
    timestamp: Date
  }]
}
```

---

## 5. API Endpoints

### Base URL
- **Development:** `http://localhost:5000/api`
- **Production:** `https://your-render-app.onrender.com/api`

---

### Junctions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/junctions` | No | Get all junctions with current signal state + live density from Redis |
| `GET` | `/junctions/:id` | No | Single junction detail |
| `POST` | `/junctions` | Admin | Register a new junction |
| `PUT` | `/junctions/:id` | Admin | Update junction config (location, lane count) |
| `DELETE` | `/junctions/:id` | Admin | Remove junction |

**GET /junctions response example:**
```json
[
  {
    "_id": "abc123",
    "name": "Junction A1 - MG Road",
    "location": { "lat": 22.572, "lng": 88.363 },
    "currentPhase": { "type": "green", "direction": "NS" },
    "timing": { "greenDuration": 45, "redDuration": 30 },
    "liveData": {
      "vehicleCount": 23,
      "densityScore": 72,
      "densityLevel": "high"
    }
  }
]
```

---

### Signals

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/signals/:junctionId` | No | Current phase + timing for one junction |
| `POST` | `/signals/:junctionId/override` | Operator | Manually force a signal phase |
| `POST` | `/signals/optimize` | Internal | Trigger AI re-optimization for all junctions now |
| `POST` | `/signals/restore/:junctionId` | Operator | Clear override, return to AI control |

**POST /signals/:junctionId/override body:**
```json
{
  "phase": "green",
  "direction": "NS",
  "durationSeconds": 60,
  "reason": "manual operator override"
}
```

---

### Density

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/density/report` | Internal | AI service posts vehicle count every 5s |
| `GET` | `/density/current` | No | Live density for all junctions (from Redis, very fast) |
| `GET` | `/density/history/:junctionId` | No | Historical readings from MongoDB (for charts) |

**POST /density/report body** (sent by Python service):
```json
{
  "junctionId": "abc123",
  "vehicleCount": 18,
  "densityScore": 58,
  "densityLevel": "medium",
  "frameTimestamp": "2025-03-16T10:23:45Z"
}
```

---

### Emergency Corridor

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/emergency/activate` | Vehicle | Ambulance activates corridor — returns planned route |
| `POST` | `/emergency/location` | Vehicle | Live GPS ping every 2s while active |
| `POST` | `/emergency/deactivate` | Vehicle | Clear corridor, restore signal timings |
| `GET` | `/emergency/active` | No | All currently active corridors |
| `GET` | `/emergency/history` | No | Past events with response times |

**POST /emergency/activate body:**
```json
{
  "vehicleId": "AMB-KOL-042",
  "vehicleType": "ambulance",
  "currentLocation": { "lat": 22.572, "lng": 88.363 },
  "destination": { "lat": 22.581, "lng": 88.380 },
  "destinationName": "SSKM Hospital"
}
```

**POST /emergency/activate response:**
```json
{
  "eventId": "evt_xyz789",
  "corridorJunctions": ["jnc_001", "jnc_004", "jnc_007"],
  "estimatedClearTimeSeconds": 14,
  "message": "Corridor active. 3 junctions preempted."
}
```

---

### Analytics

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/analytics/summary` | No | Avg wait times, peak hours, junction performance scores |
| `GET` | `/analytics/emergency-log` | No | Past emergency events + response times |
| `GET` | `/analytics/peak-hours` | No | Hour-by-hour density averages (for charts) |

---

### Python AI Service (internal — Node calls these, not React)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `:5001/analyze` | Send base64 camera frame → get `{ vehicleCount, densityScore }` |
| `POST` | `:5001/optimize-timing` | Send all junction densities → get recommended timings for each |
| `GET` | `:5001/health` | Health check |

**POST :5001/analyze body:**
```json
{
  "junctionId": "abc123",
  "frame": "<base64 encoded image string>",
  "timestamp": "2025-03-16T10:23:45Z"
}
```

---

## 6. Socket.IO Events

### Server → Client (React listens to these)

| Event | Payload | What React does |
|---|---|---|
| `signal:updated` | `{ junctionId, phase, direction, duration }` | Updates map pin colour and signal grid card |
| `density:updated` | `{ junctionId, vehicleCount, densityScore, densityLevel }` | Updates heatmap overlay and stats bar |
| `emergency:activated` | `{ eventId, corridorJunctions[], vehicleId, vehicleType }` | Highlights corridor route red on map, shows alert banner |
| `emergency:location` | `{ eventId, lat, lng, timestamp }` | Moves animated vehicle marker on map |
| `emergency:cleared` | `{ eventId, responseTimeSecs }` | Removes corridor highlight, shows completion toast |
| `system:alert` | `{ level, message }` | Shows notification for critical events |

### Client → Server (React emits these)

| Event | Payload | When |
|---|---|---|
| `operator:override` | `{ junctionId, phase, direction, duration }` | Dashboard operator manually changes a signal |

---

## 7. Environment Variables

### server/.env
```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/trafficai

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=replace_this_with_a_long_random_string

# Python AI service
AI_SERVICE_URL=http://localhost:5001

# Polling interval (milliseconds)
DENSITY_POLL_INTERVAL=5000
```

### client/.env
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### ai-service/.env
```env
PORT=5001
MODEL_PATH=./models/yolov8n.pt

# Set to "mock" during early dev — returns fake density data without real camera
MODE=mock
```

> **Important:** Add `.env` to `.gitignore`. Commit `.env.example` with all keys but no values.

---

## 8. Hosting & Deployment

### Services Breakdown

| Service | Host | Tier | Cost | Notes |
|---|---|---|---|---|
| React client | **Vercel** | Free | $0 | Auto-deploy from GitHub, CDN included |
| Node + Express | **Render.com** | Free | $0 | Supports WebSockets (critical for Socket.IO) |
| MongoDB | **MongoDB Atlas** | M0 Free | $0 | 512MB storage, enough for hackathon |
| Redis | **Upstash** | Free | $0 | 10k commands/day free, works great with Node |
| Python AI service | **Render.com** | Starter | ~$7/mo | Needs 512MB+ RAM for YOLO model |

> **Hackathon tip:** For the demo, you can run the Python AI service locally and use `ngrok` to expose it publicly — saves the $7.

### docker-compose.yml (local dev)
```yaml
version: '3.8'
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  server:
    build: ./server
    ports:
      - "5000:5000"
    env_file: ./server/.env
    depends_on: [mongo, redis]

  ai-service:
    build: ./ai-service
    ports:
      - "5001:5001"
    env_file: ./ai-service/.env

  client:
    build: ./client
    ports:
      - "3000:3000"
    env_file: ./client/.env
```

### Deployment Checklist
- [ ] MongoDB Atlas cluster created, IP whitelist set to `0.0.0.0/0`
- [ ] All `.env` variables set in Render/Vercel dashboard
- [ ] `VITE_API_URL` in client points to production Node URL
- [ ] CORS in Express allows your Vercel domain
- [ ] Socket.IO CORS config updated for production URL
- [ ] Redis `REDIS_URL` updated to Upstash production URL

---

## 9. Build Phases

> Each phase produces something **demoable**. Never be stuck with nothing to show.

---

### Phase 0 — Project Setup (Day 1 · ~2 hours)

**Goal:** Repo, folder structure, all services running locally

- [ ] Create GitHub repo, invite team members
- [ ] Scaffold folder structure exactly as in Section 3
- [ ] Init Node server (`npm init`, install express, mongoose, socket.io, ioredis, cors, dotenv, node-cron, axios, jsonwebtoken)
- [ ] Init React client (`npm create vite@latest client -- --template react`)
- [ ] Install React packages: `react-leaflet leaflet socket.io-client axios react-router-dom recharts`
- [ ] Create Python venv, `pip install fastapi uvicorn ultralytics opencv-python-headless`
- [ ] Add `.env`, `.gitignore`, `docker-compose.yml`
- [ ] Verify: `node server/index.js` runs, React dev server starts, Python `uvicorn main:app` starts

**Deliverable:** Three terminals running, no errors.

---

### Phase 1 — Data Layer (Day 1 · ~3 hours)

**Goal:** MongoDB connected, all models defined, basic CRUD working

- [ ] `config/db.js` — mongoose connection with error handling
- [ ] Write all three Mongoose models: `Junction`, `TrafficLog`, `EmergencyEvent`
- [ ] Write `routes/junctions.js` — GET all, GET by ID, POST, PUT
- [ ] Seed database with 5–8 fake junctions (write a `seed.js` script)
- [ ] Test all junction routes with Postman or Thunder Client
- [ ] `config/redis.js` — ioredis client, test with a `redis.set / redis.get`

**Deliverable:** `GET /api/junctions` returns seeded data. Postman screenshots for judges.

---

### Phase 2 — Real-Time Engine (Day 1–2 · ~4 hours)

**Goal:** Socket.IO working, live signal updates flowing to React

- [ ] `config/socket.js` — attach Socket.IO to Express HTTP server
- [ ] Write `jobs/densityPoller.js` — node-cron job every 5s that:
  - Loops through all junctions
  - For now: generates **mock density data** (random `vehicleCount` 0–50)
  - Calls `signalOptimizer.js` with the density
  - Emits `signal:updated` and `density:updated` via Socket.IO
- [ ] `services/signalOptimizer.js` — simple rule: if count > 30 → green 60s, if 15–30 → 45s, if < 15 → 25s
- [ ] `hooks/useSocket.js` in React — connect to server, listen for `signal:updated`
- [ ] `components/SignalGrid.jsx` — grid of junction cards, colour changes green/red live

**Deliverable:** Open browser, watch junction cards flicker between green and red in real time. This is your first wow moment.

---

### Phase 3 — The Live Map (Day 2 · ~3 hours)

**Goal:** Interactive map showing all junctions with live signal colours

- [ ] `components/TrafficMap.jsx` — Leaflet map centred on your city
- [ ] Place a marker for each junction fetched from `GET /api/junctions`
- [ ] Marker colour = current signal phase (green/red/yellow)
- [ ] When `signal:updated` socket event fires → update that marker's colour live
- [ ] When `density:updated` fires → show a small popup with vehicle count on hover
- [ ] Add `StatsBar.jsx` at top — total active junctions, highest density junction, live vehicle count sum

**Deliverable:** A live animated map. This is the most visually impressive thing for judges — spend time making it look good.

---

### Phase 4 — Emergency Corridor (Day 2–3 · ~5 hours)

**Goal:** Emergency vehicle activates corridor, map goes red, lights clear

- [ ] `services/corridorPlanner.js` — takes origin + destination coords, returns ordered list of junction IDs along the route
  - Simple approach: find junctions sorted by proximity to the straight line between origin and destination
  - Better: implement basic A* over junction graph (store neighbours in Junction model)
- [ ] `routes/emergency.js` — POST /activate, POST /location, POST /deactivate
- [ ] On activate: call corridorPlanner → override each junction signal → emit `emergency:activated`
- [ ] On location ping: update EmergencyEvent gpsPings array → emit `emergency:location`
- [ ] On deactivate: restore all overridden junctions → emit `emergency:cleared`
- [ ] `components/EmergencyPanel.jsx` — button to simulate emergency activation, shows active corridor list
- [ ] React: on `emergency:activated` → draw red polyline on map through corridor junctions
- [ ] React: on `emergency:location` → animated red dot moves along the route

**Deliverable:** Click "Activate Emergency", watch the map light up red, signals clear. This is your killer demo feature.

---

### Phase 5 — Python AI Service (Day 3 · ~4 hours)

**Goal:** Real computer vision replacing mock density data

- [ ] `ai-service/main.py` — FastAPI with `/analyze` and `/optimize-timing` routes
- [ ] `ai-service/detector.py` — load YOLOv8n, count vehicles in a frame:
  ```python
  from ultralytics import YOLO
  model = YOLO('models/yolov8n.pt')
  results = model(frame)
  vehicle_classes = [2, 3, 5, 7]  # car, motorbike, bus, truck in COCO
  count = sum(1 for box in results[0].boxes if int(box.cls) in vehicle_classes)
  ```
- [ ] `ai-service/optimizer.py` — Webster's formula for optimal cycle length
- [ ] `services/aiClient.js` in Node — replace mock data in `densityPoller.js` with real `axios.post` to Python
- [ ] Test with a static test image first before connecting to real camera
- [ ] Add `MODE=mock` env var so you can toggle back to fake data if Python is slow

**Deliverable:** Real vehicle counts from a test image or video file feeding into the live dashboard.

---

### Phase 6 — Analytics & Polish (Day 3–4 · ~3 hours)

**Goal:** Analytics page, clean UI, demo-ready

- [ ] `routes/analytics.js` — summary stats, peak hour query from TrafficLog
- [ ] `pages/Analytics.jsx` — Recharts line chart: vehicle count over time per junction
- [ ] Recharts bar chart: average density by hour of day
- [ ] Emergency response times table
- [ ] UI polish: consistent colours, loading states, error boundaries
- [ ] Mobile responsive (judges often check on phone)
- [ ] Write `README.md` with setup instructions and architecture diagram

**Deliverable:** Full working product end to end. Ready to demo.

---

### Phase 7 — Hardening & Demo Prep (Day 4 · ~2 hours)

**Goal:** Nothing breaks during the demo

- [ ] Add error handling everywhere — what if Python service is down? fall back to mock data
- [ ] Add a "Demo Mode" button in the UI that auto-runs a simulated emergency scenario
- [ ] Seed realistic junction data for your actual city
- [ ] Test the full demo flow 5 times without breaking
- [ ] Prepare a 2-minute verbal walkthrough script for judges
- [ ] Deploy to production (Vercel + Render + Atlas + Upstash)
- [ ] Record a screen recording backup in case live demo fails

**Deliverable:** Deployed URL. Working demo. Backup recording.

---

## 10. Hackathon Presentation Tips

### Your Demo Script (2 minutes)

1. **Problem (20s):** "In India, traffic congestion costs X hours annually. Emergency vehicles lose Y minutes on average reaching hospitals."
2. **Show live map (30s):** Open dashboard, point to junctions updating in real time, explain the AI is counting vehicles from cameras.
3. **Trigger emergency (40s):** Click "Activate Emergency Corridor", say "An ambulance just activated the system from [location] to [hospital]", watch the map go red, explain each signal is turning green as the vehicle approaches.
4. **Show analytics (20s):** Switch to analytics tab, show peak hour chart, response time metrics.
5. **Close (10s):** "This runs on standard CCTV cameras already installed at most major junctions — no new hardware needed."

### What Judges Care About
- **Does it actually work live?** — test your demo 10 times
- **Is the problem real?** — have a stat ready (India traffic congestion stats, ambulance response times)
- **Is the AI real?** — be ready to explain YOLOv8 in one sentence: "We use a pre-trained neural network that can identify vehicles in video frames in under 50ms"
- **Can it scale?** — "Each city district gets its own Node instance, MongoDB shards by city, Redis handles the real-time layer"

### Backup Plan If Demo Breaks
- Have a screen recording of the full demo flow
- Have screenshots of every key feature in a slide deck
- Mock data fallback is already built into the system (`MODE=mock` in Python service env)

---

*Last updated: March 2026 · TrafficAI Hackathon Project*