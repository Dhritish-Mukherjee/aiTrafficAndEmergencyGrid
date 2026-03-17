import { useState, useCallback } from 'react';
import useSocket from '../hooks/useSocket';
import './SignalGrid.css';

const DENSITY_COLORS = {
  LOW: '#22c55e',
  MODERATE: '#f59e0b',
  HIGH: '#f97316',
  SEVERE: '#ef4444',
};

const DENSITY_LABELS = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  SEVERE: 'Severe',
};

const SignalGrid = ({ initialJunctions = [] }) => {
  // State: map of junctionId → { signal, density }
  const [junctionStates, setJunctionStates] = useState(() => {
    const map = {};
    initialJunctions.forEach((j) => {
      map[j._id] = {
        name: j.name,
        location: j.location,
        phase: 'green',
        greenDuration: 30,
        redDuration: 30,
        vehicleCount: 0,
        densityLevel: 'LOW',
        densityScore: 0,
        lastUpdated: null,
      };
    });
    return map;
  });

  // Handler for 'signal:updated' — flip phase colour
  const onSignalUpdated = useCallback((data) => {
    setJunctionStates((prev) => ({
      ...prev,
      [data.junctionId]: {
        ...prev[data.junctionId],
        name: data.junctionName,
        phase: 'green',   // green phase just started
        greenDuration: data.greenDuration,
        redDuration: data.redDuration,
        vehicleCount: data.vehicleCount,
        lastUpdated: data.timestamp,
      },
    }));

    // After greenDuration seconds flip to red
    setTimeout(() => {
      setJunctionStates((prev) => ({
        ...prev,
        [data.junctionId]: {
          ...prev[data.junctionId],
          phase: 'red',
        },
      }));
    }, data.greenDuration * 1000);
  }, []);

  // Handler for 'density:updated' — update vehicle count display
  const onDensityUpdated = useCallback((data) => {
    setJunctionStates((prev) => {
      const existing = prev[data.junctionId];
      if (!existing) return prev;
      return {
        ...prev,
        [data.junctionId]: {
          ...existing,
          vehicleCount: data.vehicleCount,
          densityLevel: data.densityLevel,
          densityScore: data.densityScore,
        },
      };
    });
  }, []);

  useSocket({
    'signal:updated': onSignalUpdated,
    'density:updated': onDensityUpdated,
  });

  const junctions = Object.entries(junctionStates);

  return (
    <div className="signal-grid-wrapper">
      <div className="signal-grid-header">
        <h1 className="signal-grid-title">🚦 AI Traffic &amp; Emergency Grid</h1>
        <p className="signal-grid-subtitle">
          Live signal status · Mumbai — Updates every 5 seconds
        </p>
      </div>

      <div className="signal-grid">
        {junctions.length === 0 ? (
          <p className="signal-grid-empty">Awaiting junction data from server…</p>
        ) : (
          junctions.map(([id, j]) => (
            <div
              key={id}
              className={`junction-card phase-${j.phase}`}
              id={`junction-card-${id}`}
            >
              {/* Traffic light indicator */}
              <div className="traffic-light">
                <div className={`light red-light   ${j.phase === 'red'   ? 'active' : ''}`} />
                <div className="light amber-light" />
                <div className={`light green-light ${j.phase === 'green' ? 'active' : ''}`} />
              </div>

              <div className="junction-info">
                <h2 className="junction-name">{j.name}</h2>

                <div
                  className="density-badge"
                  style={{ background: DENSITY_COLORS[j.densityLevel] }}
                >
                  {DENSITY_LABELS[j.densityLevel]}
                </div>

                <div className="junction-stats">
                  <div className="stat">
                    <span className="stat-label">Vehicles</span>
                    <span className="stat-value">{j.vehicleCount}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Density</span>
                    <span className="stat-value">{j.densityScore}%</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">🟢 Green</span>
                    <span className="stat-value">{j.greenDuration}s</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">🔴 Red</span>
                    <span className="stat-value">{j.redDuration}s</span>
                  </div>
                </div>

                <div className="junction-phase-label">
                  {j.phase === 'green' ? '🟢 GREEN' : '🔴 RED'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SignalGrid;
