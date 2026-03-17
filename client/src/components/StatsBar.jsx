import { useState, useCallback } from 'react';
import useSocket from '../hooks/useSocket';
import './StatsBar.css';

const DENSITY_PRIORITY = { 'LOW': 0, 'MODERATE': 1, 'HIGH': 2, 'SEVERE': 3 };
const DENSITY_COLORS = {
  LOW: '#22c55e',
  MODERATE: '#f59e0b',
  HIGH: '#f97316',
  SEVERE: '#ef4444',
};

const StatsBar = ({ initialJunctions = [] }) => {
  const [densityMap, setDensityMap] = useState(() => {
    const map = {};
    initialJunctions.forEach((j) => {
      map[j._id] = {
        name: j.name,
        vehicleCount: 0,
        densityLevel: 'LOW',
        densityScore: 0,
      };
    });
    return map;
  });

  const onDensityUpdated = useCallback((data) => {
    setDensityMap((prev) => {
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
    'density:updated': onDensityUpdated,
  });

  const entries = Object.values(densityMap);
  const totalJunctions = entries.length;
  const totalVehicles = entries.reduce((sum, j) => sum + j.vehicleCount, 0);

  // Find highest density junction
  let hotspot = entries[0] || { name: '—', densityLevel: 'LOW', densityScore: 0 };
  entries.forEach((j) => {
    if (
      DENSITY_PRIORITY[j.densityLevel] > DENSITY_PRIORITY[hotspot.densityLevel] ||
      (j.densityLevel === hotspot.densityLevel && j.densityScore > hotspot.densityScore)
    ) {
      hotspot = j;
    }
  });

  const avgDensity = totalJunctions > 0
    ? Math.round(entries.reduce((sum, j) => sum + j.densityScore, 0) / totalJunctions)
    : 0;

  return (
    <div className="stats-bar">
      <div className="stats-bar-inner">
        {/* Stat 1: Active Junctions */}
        <div className="stat-card">
          <div className="stat-card-icon">🚦</div>
          <div className="stat-card-body">
            <span className="stat-card-value">{totalJunctions}</span>
            <span className="stat-card-label">Active Junctions</span>
          </div>
        </div>

        {/* Stat 2: Total Vehicles */}
        <div className="stat-card">
          <div className="stat-card-icon">🚗</div>
          <div className="stat-card-body">
            <span className="stat-card-value">{totalVehicles}</span>
            <span className="stat-card-label">Total Vehicles</span>
          </div>
        </div>

        {/* Stat 3: Avg Density */}
        <div className="stat-card">
          <div className="stat-card-icon">📊</div>
          <div className="stat-card-body">
            <span className="stat-card-value">{avgDensity}%</span>
            <span className="stat-card-label">Avg Density</span>
          </div>
        </div>

        {/* Stat 4: Hotspot */}
        <div className="stat-card stat-card--hotspot">
          <div className="stat-card-icon">🔥</div>
          <div className="stat-card-body">
            <span
              className="stat-card-value"
              style={{ color: DENSITY_COLORS[hotspot.densityLevel] }}
            >
              {hotspot.name}
            </span>
            <span className="stat-card-label">Highest Density</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsBar;
