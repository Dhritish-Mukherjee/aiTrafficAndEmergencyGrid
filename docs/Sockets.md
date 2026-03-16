# Socket.IO Events Reference

> **Server URL (dev):** `http://localhost:5000`  
> **Server URL (prod):** `https://your-app.onrender.com`  
> **Namespace:** `/` (default)

---

## Quick Setup in React

```js
// src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(handlers) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => console.log('Socket connected:', socket.id));
    socket.on('disconnect', () => console.log('Socket disconnected'));

    // Register all event handlers passed in
    Object.entries(handlers).forEach(([event, fn]) => {
      socket.on(event, fn);
    });

    return () => socket.disconnect();
  }, []);

  return socketRef;
}
```

```jsx
// Usage in Dashboard.jsx
const socketRef = useSocket({
  'signal:updated':      (data) => updateJunctionSignal(data),
  'density:updated':     (data) => updateJunctionDensity(data),
  'emergency:activated': (data) => activateCorridorOnMap(data),
  'emergency:location':  (data) => moveVehicleMarker(data),
  'emergency:cleared':   (data) => clearCorridorFromMap(data),
});
```

---

## Server → Client Events

These events are **emitted by the Node server** and **listened to by React**.

---

### `signal:updated`

Fired whenever a junction's signal phase changes — either from the AI optimizer, a manual override, or an emergency preemption.

**Payload:**
```json
{
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "phase": "green",
  "direction": "NS",
  "timing": {
    "greenDuration": 45,
    "redDuration": 30
  },
  "isOverridden": false,
  "reason": "ai_optimizer",
  "timestamp": "2025-03-16T10:23:45Z"
}
```

**`reason` values:**
| Value | Meaning |
|---|---|
| `ai_optimizer` | Normal 5s cycle update from AI |
| `manual_override` | Operator forced a phase from dashboard |
| `emergency_preempt` | Emergency corridor turned it green |
| `emergency_restore` | Signal restored after corridor cleared |

**What React should do:**
- Update the junction's marker colour on the Leaflet map
- Update the signal card in `SignalGrid.jsx`
- If `reason === 'emergency_preempt'`, show the junction as pulsing red/green

---

### `density:updated`

Fired every 5 seconds per junction as new vehicle counts arrive from the AI service.

**Payload:**
```json
{
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "vehicleCount": 23,
  "densityScore": 72,
  "densityLevel": "high",
  "timestamp": "2025-03-16T10:23:45Z"
}
```

**`densityLevel` values:**
| Value | Score Range | Suggested colour |
|---|---|---|
| `low` | 0 – 25 | Green `#22c55e` |
| `medium` | 26 – 50 | Yellow `#eab308` |
| `high` | 51 – 75 | Orange `#f97316` |
| `critical` | 76 – 100 | Red `#ef4444` |

**What React should do:**
- Update the density indicator on the map marker (size or colour ring)
- Update the vehicle count in `StatsBar.jsx`
- Update the heatmap overlay if you have one

---

### `emergency:activated`

Fired when an emergency vehicle activates a green corridor. This is the most important event for the dashboard UI.

**Payload:**
```json
{
  "eventId": "65f1a2b3c4d5e6f7a8b9ffff",
  "vehicleId": "AMB-KOL-042",
  "vehicleType": "ambulance",
  "origin": { "lat": 22.5726, "lng": 88.3639 },
  "destination": { "lat": 22.5815, "lng": 88.3820 },
  "destinationName": "SSKM Hospital",
  "corridorJunctions": [
    {
      "id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Junction A1 - MG Road",
      "location": { "lat": 22.5726, "lng": 88.3639 },
      "activatesAt": "2025-03-16T10:20:00Z"
    },
    {
      "id": "65f1a2b3c4d5e6f7a8b9c0d4",
      "name": "Junction A4 - Gariahat",
      "location": { "lat": 22.5770, "lng": 88.3715 },
      "activatesAt": "2025-03-16T10:20:08Z"
    }
  ],
  "timestamp": "2025-03-16T10:20:00Z"
}
```

**What React should do:**
- Draw a red `Polyline` on the Leaflet map connecting all `corridorJunctions` locations
- Place an animated ambulance marker at `origin`
- Show an alert banner: "Emergency corridor active — AMB-KOL-042 to SSKM Hospital"
- Add the event to the `EmergencyPanel` active list
- Change all corridor junction map pins to pulsing red

---

### `emergency:location`

Fires every 2 seconds while an emergency is active. Use this to animate the vehicle marker moving along the corridor.

**Payload:**
```json
{
  "eventId": "65f1a2b3c4d5e6f7a8b9ffff",
  "vehicleId": "AMB-KOL-042",
  "lat": 22.5741,
  "lng": 88.3658,
  "timestamp": "2025-03-16T10:20:06Z"
}
```

**What React should do:**
- Move the animated vehicle marker to the new `lat/lng` position
- Optionally draw a trail of the path taken so far

---

### `emergency:cleared`

Fired when the emergency vehicle deactivates the corridor (reached destination or manually cleared).

**Payload:**
```json
{
  "eventId": "65f1a2b3c4d5e6f7a8b9ffff",
  "vehicleId": "AMB-KOL-042",
  "responseTimeSecs": 142,
  "timestamp": "2025-03-16T10:22:22Z"
}
```

**What React should do:**
- Remove the red polyline from the map
- Remove the vehicle marker
- Restore corridor junction map pins to their normal density colour
- Show a toast: "Corridor cleared in 2m 22s"
- Remove from the `EmergencyPanel` active list

---

### `system:alert`

General system notification for critical events. Show as a notification/toast.

**Payload:**
```json
{
  "level": "warning",
  "message": "Junction A3 has been offline for 30s — using cached data",
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d3",
  "timestamp": "2025-03-16T10:23:45Z"
}
```

**`level` values:** `info` | `warning` | `critical`

---

## Client → Server Events

These events are **emitted by React** and **listened to by the Node server**.

---

### `operator:override`

Sent when a dashboard operator manually changes a signal phase. The server validates it, applies the override, and broadcasts `signal:updated` back to all clients.

**Emit:**
```js
socket.emit('operator:override', {
  junctionId: '65f1a2b3c4d5e6f7a8b9c0d1',
  phase: 'green',
  direction: 'NS',
  durationSeconds: 60
});
```

**Payload:**
```json
{
  "junctionId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "phase": "green",
  "direction": "NS",
  "durationSeconds": 60
}
```

---

## Connection Events (Built-in)

These are standard Socket.IO events — no custom payload.

| Event | Direction | When |
|---|---|---|
| `connect` | Server → Client | Successfully connected |
| `disconnect` | Server → Client | Connection dropped |
| `connect_error` | Server → Client | Failed to connect |

**Handle reconnection in your hook:**
```js
socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err.message);
  // show offline indicator in UI
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // server forcefully disconnected — reconnect manually
    socket.connect();
  }
  // otherwise socket.io will auto-reconnect
});
```

---

## Event Flow Summary

```
[Python AI] ──5s──► POST /density/report
                         │
                    [Node Server]
                         │
                    ├── Redis.set(junction density)
                    ├── MongoDB.save(TrafficLog)
                    ├── signalOptimizer() → new timings
                    ├── io.emit('density:updated')  ──────────► [React]
                    └── io.emit('signal:updated')   ──────────► [React]


[Ambulance] ──────► POST /emergency/activate
                         │
                    [Node Server]
                         │
                    ├── corridorPlanner() → junction list
                    ├── override each junction signal
                    ├── io.emit('emergency:activated') ────────► [React]
                    └── response { eventId, corridorJunctions }

[Ambulance] ──2s──► POST /emergency/location
                         │
                    [Node Server]
                         └── io.emit('emergency:location') ────► [React]

[Ambulance] ──────► POST /emergency/deactivate
                         │
                    [Node Server]
                         │
                    ├── restore all junction signals
                    └── io.emit('emergency:cleared') ──────────► [React]
```

---

*Last updated: March 2026*