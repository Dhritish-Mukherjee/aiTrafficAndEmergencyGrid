import { useCallback, useState } from 'react';
import {
  MapContainer, TileLayer, CircleMarker,
  Popup, Polyline, Marker, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import useSocket from '../hooks/useSocket';
import './TrafficMap.css';

const PHASE_COLORS = {
  green:  '#22c55e',
  red:    '#ef4444',
  yellow: '#eab308',
};

const DENSITY_LEVELS = {
  LOW:      { label: 'Low',      color: '#22c55e' },
  MODERATE: { label: 'Moderate', color: '#f59e0b' },
  HIGH:     { label: 'High',     color: '#f97316' },
  SEVERE:   { label: 'Critical', color: '#ef4444' },
};

const CITY_CENTER  = [19.02, 72.84];
const DEFAULT_ZOOM = 13;

// ── Ambulance DivIcon ─────────────────────────────────────────────────────────
const ambulanceIcon = L.divIcon({
  className: '',
  html: `<div class="ambulance-marker">🚑</div>`,
  iconSize:   [40, 40],
  iconAnchor: [20, 20],
});

// ── Auto-pan to ambulance when it moves ──────────────────────────────────────
const MapPanner = ({ pos }) => {
  const map = useMap();
  if (pos) map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.8 });
  return null;
};

const TrafficMap = ({ initialJunctions = [], emergencyState = {}, onJunctionMapReady }) => {
  const [junctionMap, setJunctionMap] = useState(() => {
    const map = {};
    initialJunctions.forEach((j) => {
      map[j._id] = {
        ...j,
        phase: 'green',
        vehicleCount: 0,
        densityLevel: 'LOW',
        densityScore: 0,
        greenDuration: 30,
        redDuration: 30,
      };
    });
    // hand it up to parent immediately so useEmergency can read locations
    if (onJunctionMapReady) onJunctionMapReady(map);
    return map;
  });

  const onSignalUpdated = useCallback((data) => {
    setJunctionMap((prev) => {
      const ex = prev[data.junctionId];
      if (!ex) return prev;
      return { ...prev, [data.junctionId]: { ...ex, phase: 'green', greenDuration: data.greenDuration, redDuration: data.redDuration, vehicleCount: data.vehicleCount } };
    });
    setTimeout(() => {
      setJunctionMap((prev) => {
        const ex = prev[data.junctionId];
        if (!ex) return prev;
        return { ...prev, [data.junctionId]: { ...ex, phase: 'red' } };
      });
    }, data.greenDuration * 1000);
  }, []);

  const onDensityUpdated = useCallback((data) => {
    setJunctionMap((prev) => {
      const ex = prev[data.junctionId];
      if (!ex) return prev;
      return { ...prev, [data.junctionId]: { ...ex, vehicleCount: data.vehicleCount, densityLevel: data.densityLevel, densityScore: data.densityScore } };
    });
  }, []);

  useSocket({
    'signal:updated':  onSignalUpdated,
    'density:updated': onDensityUpdated,
  });

  const {
    active: emergencyActive = false,
    corridorJunctionIds = new Set(),
    corridorPositions   = [],
    ambulancePos        = null,
  } = emergencyState;

  const junctions = Object.values(junctionMap);

  // Build Polyline latlngs from corridorPositions
  const polylinePoints = corridorPositions.map((p) => [p.lat, p.lng]);

  return (
    <div className="traffic-map-container">
      <MapContainer
        center={CITY_CENTER}
        zoom={DEFAULT_ZOOM}
        className="traffic-map"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* ── Emergency corridor polyline ─────────────────────────────── */}
        {emergencyActive && polylinePoints.length > 1 && (
          <Polyline
            positions={polylinePoints}
            pathOptions={{
              color: '#ef4444',
              weight: 5,
              opacity: 0.85,
              dashArray: '10 6',
              className: 'corridor-line',
            }}
          />
        )}

        {/* ── Junction markers ────────────────────────────────────────── */}
        {junctions.map((j) => {
          const inCorridor = corridorJunctionIds.has(j._id);
          const isCritical  = j.densityLevel === 'SEVERE';

          let color = PHASE_COLORS[j.phase] || '#eab308';
          let markerClass = '';

          if (inCorridor && emergencyActive) {
            // Corridor junctions flash pulsing red
            color = '#ef4444';
            markerClass = 'marker-emergency-pulse';
          } else if (isCritical) {
            markerClass = 'marker-pulse';
          }

          return (
            <CircleMarker
              key={j._id}
              center={[j.location.lat, j.location.lng]}
              radius={inCorridor && emergencyActive ? 20 : isCritical ? 18 : 14}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: inCorridor && emergencyActive ? 0.9 : 0.75,
                weight: inCorridor && emergencyActive ? 3 : 2,
                className: markerClass,
              }}
            >
              <Popup className="junction-popup">
                <div className="popup-content">
                  <h3 className="popup-title">
                    {inCorridor && emergencyActive ? '🚨 ' : ''}{j.name}
                  </h3>
                  <div className="popup-divider" />
                  <div className="popup-stats">
                    <div className="popup-stat">
                      <span className="popup-stat-label">Phase</span>
                      <span className="popup-stat-value" style={{ color: PHASE_COLORS[j.phase] }}>
                        {inCorridor && emergencyActive ? 'OVERRIDE' : j.phase.toUpperCase()}
                      </span>
                    </div>
                    <div className="popup-stat">
                      <span className="popup-stat-label">Vehicles</span>
                      <span className="popup-stat-value">{j.vehicleCount}</span>
                    </div>
                    <div className="popup-stat">
                      <span className="popup-stat-label">Density</span>
                      <span className="popup-stat-value" style={{ color: DENSITY_LEVELS[j.densityLevel]?.color }}>
                        {DENSITY_LEVELS[j.densityLevel]?.label}
                      </span>
                    </div>
                    <div className="popup-stat">
                      <span className="popup-stat-label">Green</span>
                      <span className="popup-stat-value">{inCorridor && emergencyActive ? '90s 🚨' : `${j.greenDuration}s`}</span>
                    </div>
                    <div className="popup-stat">
                      <span className="popup-stat-label">Red</span>
                      <span className="popup-stat-value">{j.redDuration}s</span>
                    </div>
                    <div className="popup-stat">
                      <span className="popup-stat-label">Lanes</span>
                      <span className="popup-stat-value">{j.laneCount}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* ── Ambulance marker ────────────────────────────────────────── */}
        {emergencyActive && ambulancePos && (
          <>
            <Marker
              position={[ambulancePos.lat, ambulancePos.lng]}
              icon={ambulanceIcon}
            />
            <MapPanner pos={ambulancePos} />
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default TrafficMap;
