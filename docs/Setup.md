# Setup Guide

> Complete instructions for running TrafficAI locally and deploying to production.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
  - [Option A — Docker (Recommended)](#option-a--docker-recommended)
  - [Option B — Manual](#option-b--manual)
- [Seeding the Database](#seeding-the-database)
- [Running in Mock Mode](#running-in-mock-mode)
- [Deployment](#deployment)
  - [MongoDB Atlas](#1-mongodb-atlas)
  - [Upstash Redis](#2-upstash-redis)
  - [Deploy Python AI Service](#3-deploy-python-ai-service-rendercom)
  - [Deploy Node Server](#4-deploy-node-server-rendercom)
  - [Deploy React Client](#5-deploy-react-client-vercel)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Python | 3.10+ | `python --version` |
| Git | any | `git --version` |
| Docker + Compose | any | `docker --version` (optional) |

---

## Local Development

### Option A — Docker (Recommended)

Docker starts MongoDB, Redis, Node, Python, and React all at once. No manual installs needed.

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/trafficai.git
cd trafficai

# 2. Copy env files
cp server/.env.example server/.env
cp client/.env.example client/.env
cp ai-service/.env.example ai-service/.env

# 3. Edit server/.env — fill in MONGO_URI and JWT_SECRET (see below)

# 4. Start everything
docker-compose up --build

# 5. In a separate terminal, seed the database
docker exec trafficai-server node seed.js
```

**Services:**
| Service | URL |
|---|---|
| React dashboard | http://localhost:3000 |
| Node API | http://localhost:5000 |
| Python AI | http://localhost:5001 |
| MongoDB | localhost:27017 |
| Redis | localhost:6379 |

To stop: `docker-compose down`  
To reset everything including database: `docker-compose down -v`

---

### Option B — Manual

Run each service in its own terminal.

#### Terminal 1 — MongoDB + Redis

If you have Docker available (easiest):
```bash
docker run -d -p 27017:27017 --name mongo mongo:7
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

Or install MongoDB and Redis locally via your OS package manager.

Alternatively, use cloud versions:
- MongoDB → [MongoDB Atlas](https://cloud.mongodb.com) (free M0)
- Redis → [Upstash](https://upstash.com) (free tier)

---

#### Terminal 2 — Node Server

```bash
cd server
npm install
cp .env.example .env
# Edit .env — fill in MONGO_URI, JWT_SECRET, REDIS_URL
node index.js
```

You should see:
```
MongoDB connected
Redis connected
Server running on port 5000
Density poller started (5s interval)
```

---

#### Terminal 3 — Python AI Service

```bash
cd ai-service
python -m venv venv

# macOS / Linux:
source venv/bin/activate

# Windows:
venv\Scripts\activate

pip install -r requirements.txt

# Download the YOLOv8 nano model (first run only, ~6MB):
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

cp .env.example .env
# Set MODE=mock to skip real camera during dev

uvicorn main:app --port 5001 --reload
```

You should see:
```
INFO: Started server process
INFO: Uvicorn running on http://0.0.0.0:5001
Model loaded: yolov8n.pt (mock mode: false)
```

---

#### Terminal 4 — React Client

```bash
cd client
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api
# VITE_SOCKET_URL=http://localhost:5000
npm run dev
```

Open http://localhost:3000

---

## Seeding the Database

Run the seed script to populate 8 junctions with realistic data for your city:

```bash
# With Docker:
docker exec trafficai-server node seed.js

# Manual:
cd server
node seed.js
```

The seed script creates 8 junctions arranged as a grid, connects them as neighbours for A* routing, and sets initial signal states.

To reset and re-seed:
```bash
node seed.js --reset
```

To add junctions for a specific city, edit `server/seed.js` and update the `JUNCTIONS` array with real lat/lng coordinates.

---

## Running in Mock Mode

During early development, you can run the entire system without Python or real camera feeds. The Node server generates realistic fake density data.

In `ai-service/.env`:
```env
MODE=mock
```

Or, if you don't want to run Python at all, set in `server/.env`:
```env
AI_SERVICE_URL=mock
```

When `AI_SERVICE_URL=mock`, the `densityPoller.js` skips the HTTP call to Python entirely and generates random vehicle counts. Everything else (Socket.IO, Redis, MongoDB, emergency corridor) works normally.

---

## Deployment

### 1. MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free M0 cluster
3. Create a database user (Settings → Database Access → Add User)
4. Whitelist all IPs: Network Access → Add IP → `0.0.0.0/0`
5. Get connection string: Connect → Drivers → Node.js
6. Your `MONGO_URI` will look like:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/trafficai
   ```

---

### 2. Upstash Redis

1. Go to [upstash.com](https://upstash.com)
2. Create a Redis database → choose your nearest region
3. Copy the `REDIS_URL` from the dashboard (starts with `rediss://`)
4. That's it — no extra config needed

---

### 3. Deploy Python AI Service (Render.com)

1. Push your repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo → select the repo
4. Settings:
   - **Name:** `trafficai-ai-service`
   - **Root Directory:** `ai-service`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Starter ($7/mo — needed for YOLO RAM)
5. Add environment variables (from `ai-service/.env.example`)
6. Deploy — takes ~3 min first time (downloads YOLO model)
7. Copy the service URL: `https://trafficai-ai-service.onrender.com`

> **Hackathon shortcut:** Instead of paying $7, run the Python service locally and use `ngrok`:
> ```bash
> ngrok http 5001
> ```
> Copy the ngrok URL into your Node server's `AI_SERVICE_URL`.

---

### 4. Deploy Node Server (Render.com)

1. New Web Service → connect same GitHub repo
2. Settings:
   - **Name:** `trafficai-server`
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Plan:** Free
3. Add **all** environment variables from `server/.env.example`:
   - `MONGO_URI` → your Atlas URI
   - `REDIS_URL` → your Upstash URL
   - `JWT_SECRET` → any long random string
   - `AI_SERVICE_URL` → your Python service Render URL
   - `CLIENT_URL` → your Vercel URL (add after next step)
   - `NODE_ENV` → `production`
4. Deploy

Copy your Node server URL: `https://trafficai-server.onrender.com`

---

### 5. Deploy React Client (Vercel)

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `client`
4. Add environment variables:
   - `VITE_API_URL` → `https://trafficai-server.onrender.com/api`
   - `VITE_SOCKET_URL` → `https://trafficai-server.onrender.com`
5. Deploy

6. Go back to Render → Node service → Environment → add:
   - `CLIENT_URL` → `https://trafficai.vercel.app` (your Vercel URL)
7. Redeploy the Node service to pick up the CORS update

---

### Deployment Checklist

- [ ] MongoDB Atlas cluster created, IP `0.0.0.0/0` whitelisted
- [ ] Upstash Redis created, `REDIS_URL` copied
- [ ] Python AI service deployed (or ngrok running locally)
- [ ] Node server deployed with all env vars set
- [ ] React client deployed with `VITE_API_URL` + `VITE_SOCKET_URL`
- [ ] `CLIENT_URL` in Node env points to Vercel domain (for CORS)
- [ ] Test: open Vercel URL → map loads → signals updating live
- [ ] Test: trigger emergency → corridor appears on map

---

## Environment Variables Reference

### `server/.env`

| Variable | Required | Example | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Server port (Render sets this automatically) |
| `NODE_ENV` | Yes | `production` | `development` or `production` |
| `MONGO_URI` | Yes | `mongodb+srv://...` | MongoDB Atlas connection string |
| `REDIS_URL` | Yes | `rediss://...` | Upstash or local Redis URL |
| `JWT_SECRET` | Yes | `a_long_random_string` | Used to sign JWT tokens |
| `AI_SERVICE_URL` | Yes | `http://localhost:5001` | Python service URL (or `mock`) |
| `CLIENT_URL` | Yes | `https://trafficai.vercel.app` | React app URL (for CORS) |
| `DENSITY_POLL_INTERVAL` | No | `5000` | Milliseconds between density polls |

### `client/.env`

| Variable | Required | Example | Description |
|---|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:5000/api` | Node server API base URL |
| `VITE_SOCKET_URL` | Yes | `http://localhost:5000` | Node server Socket.IO URL |

### `ai-service/.env`

| Variable | Required | Example | Description |
|---|---|---|---|
| `PORT` | No | `5001` | Python service port |
| `MODEL_PATH` | No | `./models/yolov8n.pt` | Path to YOLO weights file |
| `MODE` | No | `mock` | `live` or `mock` (mock skips real CV) |
| `CONFIDENCE_THRESHOLD` | No | `0.4` | YOLO detection confidence (0–1) |

---

## Troubleshooting

**Socket.IO not connecting in production**

Make sure `CLIENT_URL` in your Node env exactly matches your Vercel domain (no trailing slash). Also check that Render hasn't put your service to sleep — free tier sleeps after 15 min.

**`ECONNREFUSED` connecting to Redis**

If using local Redis, make sure the Redis server is running: `redis-cli ping` should return `PONG`. If using Upstash, make sure you're using `rediss://` (with SSL) not `redis://`.

**Python service crashes on startup**

YOLO requires ~500MB RAM. Render's free tier only provides 512MB total — use the Starter plan ($7) for the Python service. If you're demoing, use ngrok instead.

**Map doesn't load**

Leaflet requires its CSS to be imported. Make sure you have `import 'leaflet/dist/leaflet.css'` in your `main.jsx` and the Leaflet default icon fix:
```js
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});
```

**Emergency corridor not clearing signals**

Check that all junctions in `corridorJunctions` exist in your database. The corridor planner depends on the `neighbours` array being populated — run the seed script or manually add neighbours to each junction document.

---

*Last updated: March 2026*