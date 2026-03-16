<div align="center">

# 🚦 TrafficAI

### Dynamic Traffic Flow Optimizer & Emergency Green Corridor

**Real-time AI-powered traffic management system with computer vision and emergency vehicle prioritization**

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

[Live Demo](#) · [API Docs](./docs/API.md) · [Architecture](./docs/Architecture.md) · [Setup Guide](./docs/Setup.md)

</div>

---

## 📌 The Problem

Every day across India, millions of hours are lost to traffic congestion. More critically, emergency vehicles — ambulances, fire trucks, police — are delayed by red lights while lives hang in the balance. Traditional traffic systems run on fixed timers, completely blind to actual road conditions.

**TrafficAI fixes both problems:**

| Problem | Our Solution |
|---|---|
| Fixed signal timings ignore actual traffic | Computer vision counts vehicles every 5s and adjusts timings dynamically |
| Emergency vehicles stuck at red lights | One-tap green corridor clears every signal along the route instantly |
| No visibility into traffic patterns | Real-time dashboard with live map, heatmaps, and analytics |

---

## ✨ Features

### 🤖 AI-Powered Signal Optimization
- YOLOv8 computer vision counts vehicles at each junction every 5 seconds
- Signal timings automatically adjust based on live density scores
- Webster's formula ensures mathematically optimal cycle lengths
- Works with existing CCTV cameras — no new hardware required

### 🚨 Emergency Green Corridor
- Emergency vehicle sends one GPS ping to activate the system
- A* routing algorithm instantly plans the optimal path to the destination
- All signals along the corridor are forced green ahead of the vehicle
- Signals restore to normal automatically as the vehicle passes
- Full event logging with response time analytics

### 📊 Live Operations Dashboard
- Real-time map with animated junction markers (green/amber/red)
- Traffic density heatmap overlay
- Signal control grid with manual override capability
- Live vehicle counts and density scores per junction

### 📈 Analytics
- Historical density charts by junction and time of day
- Peak hour identification
- Emergency response time tracking
- Junction performance scoring

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│             React Dashboard                  │
│    Map · Signal Grid · Emergency Panel       │
└──────────────────┬──────────────────────────┘
                   │ HTTP + WebSocket
┌──────────────────▼──────────────────────────┐
│          Node.js + Express Server            │
│   REST API · Socket.IO · Cron Jobs · Redis  │
└──────┬───────────────────────┬──────────────┘
       │ Mongoose              │ HTTP (internal)
┌──────▼──────┐      ┌─────────▼──────────────┐
│  MongoDB     │      │  Python FastAPI         │
│  Atlas       │      │  YOLOv8 · Optimizer    │
└─────────────┘      └────────────────────────┘
```

> See [Architecture.md](./docs/Architecture.md) for the full deep-dive.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker & Docker Compose (recommended)
- MongoDB Atlas account (free)
- Redis (local or Upstash)

### Option 1 — Docker (Recommended)

```bash
# Clone the repo
git clone https://github.com/yourusername/trafficai.git
cd trafficai

# Copy environment files
cp server/.env.example server/.env
cp client/.env.example client/.env
cp ai-service/.env.example ai-service/.env

# Fill in your MongoDB URI and secrets in server/.env, then:
docker-compose up --build
```

Visit `http://localhost:3000` — all services start automatically.

### Option 2 — Manual Setup

```bash
# 1. Start MongoDB and Redis locally (or use Atlas + Upstash)

# 2. Server
cd server
npm install
cp .env.example .env      # fill in your values
node index.js             # runs on :5000

# 3. AI Service
cd ai-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 5001

# 4. Client
cd client
npm install
cp .env.example .env      # set VITE_API_URL=http://localhost:5000
npm run dev               # runs on :3000
```

> See [Setup.md](./docs/Setup.md) for detailed instructions including seeding the database.

---

## 📁 Project Structure

```
trafficai/
├── README.md
├── PLANNING.md                 ← full project plan + build phases
├── docker-compose.yml
├── .env.example
│
├── docs/
│   ├── API.md                  ← all REST endpoints + request/response examples
│   ├── Architecture.md         ← system design, data flow, tech decisions
│   ├── Setup.md                ← detailed local + production setup guide
│   └── Sockets.md              ← Socket.IO event reference
│
├── server/                     ← Node.js + Express
│   ├── config/                 ← db, redis, socket setup
│   ├── models/                 ← Mongoose schemas
│   ├── routes/                 ← REST route handlers
│   ├── services/               ← business logic
│   ├── middleware/             ← auth, error handling
│   ├── jobs/                   ← cron jobs
│   └── index.js
│
├── client/                     ← React + Vite
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       └── api/
│
└── ai-service/                 ← Python FastAPI
    ├── main.py
    ├── detector.py             ← YOLOv8 wrapper
    ├── optimizer.py            ← Webster formula
    └── models/
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast dev, component reuse |
| Map | Leaflet.js + react-leaflet | Open source, no API key needed |
| Charts | Recharts | Simple React-native charts |
| Backend | Node.js + Express | Team knows MERN |
| Real-time | Socket.IO | Easiest WebSocket abstraction |
| Database | MongoDB Atlas | Flexible schema, free tier |
| Cache | Redis (Upstash) | Sub-millisecond live density reads |
| AI/CV | Python + YOLOv8 | Best-in-class real-time object detection |
| AI Framework | FastAPI | Fast Python API, async support |
| Routing | A* algorithm | Optimal emergency path planning |
| Signal math | Webster's formula | Industry standard cycle optimization |
| Deployment | Vercel + Render | Free tiers, GitHub auto-deploy |

---

## 🔌 API Reference

Full documentation: **[docs/API.md](./docs/API.md)**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/junctions` | All junctions with live signal state |
| `POST` | `/api/emergency/activate` | Activate green corridor for emergency vehicle |
| `POST` | `/api/density/report` | AI service posts vehicle count |
| `GET` | `/api/analytics/summary` | Traffic performance summary |
| + 14 more | | |

---

## ⚡ Socket.IO Events

Full reference: **[docs/Sockets.md](./docs/Sockets.md)**

| Event | Direction | Description |
|---|---|---|
| `signal:updated` | Server → Client | Junction phase changed |
| `density:updated` | Server → Client | New vehicle count |
| `emergency:activated` | Server → Client | Corridor activated — highlight map |
| `emergency:location` | Server → Client | Vehicle moved — update marker |
| `emergency:cleared` | Server → Client | Corridor deactivated |

---

## 🌍 Deployment

| Service | Platform | Cost |
|---|---|---|
| React client | Vercel | Free |
| Node server | Render.com | Free |
| MongoDB | Atlas M0 | Free |
| Redis | Upstash | Free |
| Python AI | Render.com Starter | ~$7/mo |

> **Hackathon tip:** Run the AI service locally + `ngrok http 5001` to avoid the $7 cost during the demo.

Full deployment guide: [docs/Setup.md#deployment](./docs/Setup.md#deployment)

---

## 🤝 Contributing

This is a hackathon project. To contribute:

```bash
git checkout -b feature/your-feature-name
# make changes
git commit -m "feat: describe what you did"
git push origin feature/your-feature-name
# open a pull request
```

---

## 👥 Team

Built for **[Hackathon Name]** · [Date]

| Name | Role |
|---|---|
| [Your Name] | Full Stack + Project Lead |
| [Teammate 2] | Backend + AI Integration |
| [Teammate 3] | Frontend + UI/UX |

---

## 📄 License

MIT License — see [LICENSE](./LICENSE)

---

<div align="center">

**If this saved you time, drop a ⭐ on GitHub**

</div>