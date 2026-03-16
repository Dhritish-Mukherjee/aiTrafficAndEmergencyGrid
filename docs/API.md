# API Reference

> **Base URL (dev):** `http://localhost:5000/api`  
> **Base URL (prod):** `https://your-app.onrender.com/api`  
> **Content-Type:** `application/json` on all requests  
> **Authentication:** JWT Bearer token on protected routes

---

## Table of Contents

- [Authentication](#authentication)
- [Junctions](#junctions)
- [Signals](#signals)
- [Density](#density)
- [Emergency Corridor](#emergency-corridor)
- [Analytics](#analytics)
- [Python AI Service](#python-ai-service-internal)
- [Error Responses](#error-responses)

---

## Authentication

Protected routes require a JWT in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

> For the hackathon, only the manual signal override and junction management routes are protected. All read routes and the emergency routes are public.

---

## Junctions

### `GET /junctions`

Returns all junctions enriched with live density data from Redis.

**Auth required:** No

**Response `200`:**
```json
[
  {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Junction A1 - MG Road",
    "location": {
      "lat": 22.5726,
      "lng": 88.3639
    },
    "laneCount": 4,
    "currentPhase": {
      "type": "green",
      "direction": "NS"
    },
    "timing": {
      "greenDuration": 45,
      "redDuration": 30,
      "yellowDuration": 3
    },
    "isOverridden": false,
    "liveData": {
      "vehicleCount": 23,
      "densityScore": 72,
      "densityLevel": "high",
      "updatedAt": "2025-03-16T10:23:45Z"
    }
  }
]
```

---

### `GET /junctions/:id`

Returns a single junction by ID.

**Auth required:** No

**Params:**
| Param | Type | Description |
|---|---|---|
| `id` | string | MongoDB ObjectId of the junction |

**Response `200`:**
```json
{
  "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
  "name": "Junction A1 - MG Road",
  "location": { "lat": 22.5726, "lng": 88.3639 },
  "neighbours": ["65f1a2b3c4d5e6f7a8b9c0d2", "65f1a2b3c4d5e6f7a8b9c0d3"],
  "laneCount": 4,
  "currentPhase": { "type": "green", "direction": "NS" },
  "timing": { "greenDuration": 45, "redDuration": 30, "yellowDuration": 3 },
  "isOverridden": false,
  "liveData": {
    "vehicleCount": 23,
    "densityScore": 72,
    "densityLevel": "high"
  }
}
```

**Response `404`:**
```json
{ "error": "Junction not found" }
```

---

### `POST /junctions`

Register a new junction in the system.

**Auth required:** Yes (Admin)

**Request body:**
```json
{
  "name": "Junction B3 - Park Street",
  "location": {
    "lat": 22.5513,
    "lng": 88.3528
  },
  "laneCount": 2,
  "neighbours": ["65f1a2b3c4d5e6f7a8b9c0d1"]
}
```

**Response `201`:**
```json
{
  "_id": "65f1a2b3c4d5e6f7a8b9c0d9",
  "name": "Junction B3 - Park Street",
  "location": { "lat": 22.5513, "lng": 88.3528 },
  "laneCount": 2,
  "currentPhase": { "type": "red", "direction": "NS" },
  "timing": { "greenDuration": 30, "redDuration": 30, "yellowDuration": 3 },
  "isOverridden": false,
  "createdAt": "2025-03-16T10:00:00Z"
}
```

---

### `PUT /junctions/:id`

Update a junction's configuration.

**Auth required:** Yes (Admin)

**Request body** (all fields optional):
```json
{
  "name": "Junction A1 - MG Road Updated",
  "laneCount": 6,
  "neighbours": ["65f1a2b3c4d5e6f7a8b9c0d2"]
}
```

**Response `200`:** Returns updated junction object.

---

### `DELETE /junctions/:id`

Remove a junction from the system.

**Auth required:** Yes (Admin)

**Response `200`:**
```json
{ "message": "Junction deleted successfully" }
```

---

## Signals

### `GET /signals/:junctionId`

Get the current signal phase and timing for one junction.

**Auth required:** No

**Response `200`:**
```json
{
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "phase": "green",
  "direction": "NS",
  "timing": {
    "greenDuration": 45,
    "redDuration": 30,
    "yellowDuration": 3
  },
  "isOverridden": false,
  "nextPhaseIn": 22
}
```

---

### `POST /signals/:junctionId/override`

Manually force a junction's signal to a specific phase. Emits `signal:updated` to all connected clients.

**Auth required:** Yes (Operator)

**Request body:**
```json
{
  "phase": "green",
  "direction": "NS",
  "durationSeconds": 60,
  "reason": "Manual operator override - event clearance"
}
```

**Response `200`:**
```json
{
  "message": "Signal override applied",
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "phase": "green",
  "durationSeconds": 60,
  "overriddenUntil": "2025-03-16T10:24:45Z"
}
```

---

### `POST /signals/restore/:junctionId`

Clear a manual override and return the junction to AI-controlled timing.

**Auth required:** Yes (Operator)

**Response `200`:**
```json
{
  "message": "Junction restored to AI control",
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1"
}
```

---

### `POST /signals/optimize`

Trigger an immediate AI re-optimization of all junction timings. Normally this happens automatically every 5 seconds via the cron job — use this to force an immediate update.

**Auth required:** Yes (Admin)

**Response `200`:**
```json
{
  "message": "Optimization triggered",
  "junctionsUpdated": 8,
  "timestamp": "2025-03-16T10:23:45Z"
}
```

---

## Density

### `POST /density/report`

Called by the Python AI service every 5 seconds. Posts the latest vehicle count for one junction. Writes to Redis (instant) and MongoDB (persistent). Triggers socket events.

**Auth required:** No (internal service — restrict by IP in production)

**Request body:**
```json
{
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "vehicleCount": 18,
  "densityScore": 58,
  "densityLevel": "medium",
  "frameTimestamp": "2025-03-16T10:23:45Z"
}
```

**Response `200`:**
```json
{
  "message": "Density recorded",
  "recommendedTiming": {
    "greenDuration": 38,
    "redDuration": 30
  }
}
```

---

### `GET /density/current`

Returns live density for all junctions read directly from Redis. Very fast — use this for high-frequency polling if needed.

**Auth required:** No

**Response `200`:**
```json
{
  "timestamp": "2025-03-16T10:23:45Z",
  "junctions": [
    {
      "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "vehicleCount": 18,
      "densityScore": 58,
      "densityLevel": "medium",
      "updatedAt": "2025-03-16T10:23:45Z"
    },
    {
      "junctionId": "65f1a2b3c4d5e6f7a8b9c0d2",
      "vehicleCount": 41,
      "densityScore": 91,
      "densityLevel": "critical",
      "updatedAt": "2025-03-16T10:23:43Z"
    }
  ]
}
```

---

### `GET /density/history/:junctionId`

Returns historical density readings from MongoDB for charts and analytics.

**Auth required:** No

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `from` | ISO date string | 24h ago | Start of time range |
| `to` | ISO date string | now | End of time range |
| `interval` | `5m` \| `15m` \| `1h` | `15m` | Aggregation bucket size |

**Example:**
```
GET /density/history/65f1a2b3c4d5e6f7a8b9c0d1?from=2025-03-16T00:00:00Z&interval=1h
```

**Response `200`:**
```json
{
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "junctionName": "Junction A1 - MG Road",
  "interval": "1h",
  "data": [
    { "time": "2025-03-16T00:00:00Z", "avgVehicleCount": 4, "avgDensityScore": 12 },
    { "time": "2025-03-16T01:00:00Z", "avgVehicleCount": 2, "avgDensityScore": 6 },
    { "time": "2025-03-16T08:00:00Z", "avgVehicleCount": 38, "avgDensityScore": 87 },
    { "time": "2025-03-16T09:00:00Z", "avgVehicleCount": 45, "avgDensityScore": 100 }
  ]
}
```

---

## Emergency Corridor

### `POST /emergency/activate`

Activate a green corridor for an emergency vehicle. The server runs A* routing over the junction graph, preempts all signals along the path, and returns the corridor plan. Emits `emergency:activated` to all connected dashboard clients.

**Auth required:** No

**Request body:**
```json
{
  "vehicleId": "AMB-KOL-042",
  "vehicleType": "ambulance",
  "currentLocation": {
    "lat": 22.5726,
    "lng": 88.3639
  },
  "destination": {
    "lat": 22.5815,
    "lng": 88.3820
  },
  "destinationName": "SSKM Hospital"
}
```

**Response `200`:**
```json
{
  "eventId": "65f1a2b3c4d5e6f7a8b9ffff",
  "status": "active",
  "corridorJunctions": [
    "65f1a2b3c4d5e6f7a8b9c0d1",
    "65f1a2b3c4d5e6f7a8b9c0d4",
    "65f1a2b3c4d5e6f7a8b9c0d7"
  ],
  "estimatedClearTimeSeconds": 14,
  "greenWaveStaggerSeconds": 8,
  "message": "Corridor active. 3 junctions preempted."
}
```

---

### `POST /emergency/location`

Send a live GPS ping while a corridor is active. Updates the stored GPS trail and emits `emergency:location` to dashboard clients so the vehicle marker animates.

**Auth required:** No

**Request body:**
```json
{
  "eventId": "65f1a2b3c4d5e6f7a8b9ffff",
  "lat": 22.5741,
  "lng": 88.3658
}
```

**Response `200`:**
```json
{ "message": "Location updated" }
```

---

### `POST /emergency/deactivate`

Deactivate a corridor. All overridden junctions are restored to AI-controlled timing. Emits `emergency:cleared` to all dashboard clients.

**Auth required:** No

**Request body:**
```json
{
  "eventId": "65f1a2b3c4d5e6f7a8b9ffff"
}
```

**Response `200`:**
```json
{
  "message": "Corridor cleared",
  "eventId": "65f1a2b3c4d5e6f7a8b9ffff",
  "responseTimeSecs": 142,
  "junctionsRestored": 3
}
```

---

### `GET /emergency/active`

Returns all currently active emergency corridors.

**Auth required:** No

**Response `200`:**
```json
[
  {
    "eventId": "65f1a2b3c4d5e6f7a8b9ffff",
    "vehicleId": "AMB-KOL-042",
    "vehicleType": "ambulance",
    "destinationName": "SSKM Hospital",
    "corridorJunctions": ["..."],
    "activatedAt": "2025-03-16T10:20:00Z",
    "lastLocation": { "lat": 22.5741, "lng": 88.3658 }
  }
]
```

---

### `GET /emergency/history`

Returns past emergency events with response times.

**Auth required:** No

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `20` | Max results to return |
| `page` | number | `1` | Page number |

**Response `200`:**
```json
{
  "total": 47,
  "page": 1,
  "events": [
    {
      "eventId": "65f1a2b3c4d5e6f7a8b9ffff",
      "vehicleId": "AMB-KOL-042",
      "vehicleType": "ambulance",
      "origin": { "lat": 22.5726, "lng": 88.3639 },
      "destinationName": "SSKM Hospital",
      "corridorLength": 3,
      "activatedAt": "2025-03-16T10:20:00Z",
      "clearedAt": "2025-03-16T10:22:22Z",
      "responseTimeSecs": 142,
      "status": "cleared"
    }
  ]
}
```

---

## Analytics

### `GET /analytics/summary`

Overall system performance summary.

**Auth required:** No

**Response `200`:**
```json
{
  "generatedAt": "2025-03-16T10:23:45Z",
  "period": "last_24h",
  "totalJunctions": 8,
  "avgDensityScore": 43,
  "peakHour": "09:00",
  "peakDensityScore": 91,
  "totalEmergencyActivations": 3,
  "avgEmergencyResponseSecs": 138,
  "junctionPerformance": [
    {
      "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Junction A1 - MG Road",
      "avgDensityScore": 67,
      "peakVehicleCount": 48,
      "performanceRating": "congested"
    }
  ]
}
```

---

### `GET /analytics/peak-hours`

Average vehicle count per hour of day, aggregated across all junctions. Use for bar charts.

**Auth required:** No

**Response `200`:**
```json
{
  "data": [
    { "hour": 0,  "avgVehicleCount": 3  },
    { "hour": 1,  "avgVehicleCount": 2  },
    { "hour": 8,  "avgVehicleCount": 42 },
    { "hour": 9,  "avgVehicleCount": 48 },
    { "hour": 17, "avgVehicleCount": 45 },
    { "hour": 18, "avgVehicleCount": 51 }
  ]
}
```

---

## Python AI Service (Internal)

> These endpoints are on port `5001`. They are called by the Node server — **not by the React client directly.**

---

### `POST :5001/analyze`

Analyze a camera frame and return vehicle count.

**Request body:**
```json
{
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "frame": "<base64 encoded JPEG string>",
  "timestamp": "2025-03-16T10:23:45Z"
}
```

**Response `200`:**
```json
{
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "vehicleCount": 18,
  "densityScore": 58,
  "densityLevel": "medium",
  "inferenceMs": 34,
  "detectedClasses": {
    "car": 13,
    "motorbike": 3,
    "bus": 1,
    "truck": 1
  }
}
```

---

### `POST :5001/optimize-timing`

Given current density for all junctions, return recommended signal timings using Webster's formula.

**Request body:**
```json
{
  "junctions": [
    { "junctionId": "...abc", "vehicleCount": 18, "laneCount": 4 },
    { "junctionId": "...def", "vehicleCount": 41, "laneCount": 2 }
  ]
}
```

**Response `200`:**
```json
{
  "recommendations": [
    {
      "junctionId": "...abc",
      "greenDuration": 38,
      "redDuration": 30,
      "cycleLength": 71
    },
    {
      "junctionId": "...def",
      "greenDuration": 62,
      "redDuration": 22,
      "cycleLength": 87
    }
  ]
}
```

---

### `GET :5001/health`

Health check — returns model load status.

**Response `200`:**
```json
{
  "status": "ok",
  "modelLoaded": true,
  "mode": "live",
  "uptime": 3642
}
```

---

## Error Responses

All errors follow this shape:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

| Status | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request — missing or invalid fields |
| `401` | Unauthorized — missing or invalid JWT |
| `403` | Forbidden — valid JWT but insufficient role |
| `404` | Resource not found |
| `409` | Conflict — e.g. emergency already active for this vehicle |
| `500` | Internal server error |
| `503` | AI service unavailable — Node will fall back to mock data |

### Common Error Examples

**Missing required field (`400`):**
```json
{
  "error": "currentLocation is required",
  "code": "VALIDATION_ERROR"
}
```

**Junction not found (`404`):**
```json
{
  "error": "Junction not found",
  "code": "NOT_FOUND"
}
```

**Emergency already active (`409`):**
```json
{
  "error": "An active corridor already exists for vehicle AMB-KOL-042",
  "code": "CORRIDOR_ALREADY_ACTIVE"
}
```

**AI service down — falls back gracefully (`200` with warning):**
```json
{
  "message": "Density recorded (mock mode — AI service unreachable)",
  "warning": "Using mock density data",
  "recommendedTiming": { "greenDuration": 30, "redDuration": 30 }
}
```

---

*Last updated: March 2026*