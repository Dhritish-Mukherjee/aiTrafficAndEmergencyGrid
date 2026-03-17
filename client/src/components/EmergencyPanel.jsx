import { useState } from 'react';
import './EmergencyPanel.css';

// Pre-filled Mumbai locations for quick demo
const PRESETS = [
  {
    label: 'BKC → Haji Ali',
    origin:      { lat: 19.0664, lng: 72.8643 },
    destination: { lat: 18.9830, lng: 72.8090 },
  },
  {
    label: 'Sion → Mahalaxmi',
    origin:      { lat: 19.0390, lng: 72.8619 },
    destination: { lat: 18.9825, lng: 72.8186 },
  },
  {
    label: 'Byculla → Worli',
    origin:      { lat: 18.9790, lng: 72.8340 },
    destination: { lat: 18.9986, lng: 72.8174 },
  },
];

const EmergencyPanel = ({ emergencyState, activate, deactivate, loading, formError }) => {
  const [vehicleId, setVehicleId]         = useState('AMB-MH01-0001');
  const [originLat, setOriginLat]         = useState('');
  const [originLng, setOriginLng]         = useState('');
  const [destLat, setDestLat]             = useState('');
  const [destLng, setDestLng]             = useState('');
  const [expanded, setExpanded]           = useState(true);

  const { active, vehicleId: activeVehicle, corridorJunctionIds } = emergencyState;

  const applyPreset = (preset) => {
    setOriginLat(preset.origin.lat);
    setOriginLng(preset.origin.lng);
    setDestLat(preset.destination.lat);
    setDestLng(preset.destination.lng);
  };

  const handleActivate = (e) => {
    e.preventDefault();
    if (!vehicleId || !originLat || !originLng || !destLat || !destLng) return;
    activate({
      vehicleId,
      origin:      { lat: parseFloat(originLat),  lng: parseFloat(originLng) },
      destination: { lat: parseFloat(destLat),    lng: parseFloat(destLng) },
    });
  };

  return (
    <div className={`emergency-panel ${active ? 'emergency-panel--active' : ''}`}>
      {/* Panel header */}
      <div className="ep-header" onClick={() => setExpanded((p) => !p)}>
        <div className="ep-header-left">
          <span className="ep-icon">{active ? '🚨' : '🚑'}</span>
          <span className="ep-title">Emergency Corridor</span>
          {active && (
            <span className="ep-badge-active">ACTIVE · {corridorJunctionIds.size} junctions cleared</span>
          )}
        </div>
        <span className="ep-chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="ep-body">
          {/* Active emergency banner */}
          {active ? (
            <div className="ep-active-banner">
              <div className="ep-siren">🚨</div>
              <div className="ep-active-info">
                <p className="ep-active-label">Emergency in progress</p>
                <p className="ep-active-vehicle">{activeVehicle}</p>
                <p className="ep-active-junctions">
                  {corridorJunctionIds.size} junction{corridorJunctionIds.size !== 1 ? 's' : ''} overridden
                </p>
              </div>
              <button
                className="ep-btn ep-btn--deactivate"
                onClick={deactivate}
                disabled={loading}
              >
                {loading ? 'Clearing…' : '✅ Clear Corridor'}
              </button>
            </div>
          ) : (
            /* Activation form */
            <form className="ep-form" onSubmit={handleActivate}>
              {/* Route presets */}
              <div className="ep-presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="ep-preset-btn"
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="ep-field">
                <label className="ep-label">Vehicle ID</label>
                <input
                  className="ep-input"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  placeholder="AMB-MH01-0001"
                  required
                />
              </div>

              <div className="ep-coords-row">
                <div className="ep-field">
                  <label className="ep-label">Origin Lat</label>
                  <input className="ep-input" type="number" step="any" value={originLat} onChange={(e) => setOriginLat(e.target.value)} placeholder="19.0664" required />
                </div>
                <div className="ep-field">
                  <label className="ep-label">Origin Lng</label>
                  <input className="ep-input" type="number" step="any" value={originLng} onChange={(e) => setOriginLng(e.target.value)} placeholder="72.8643" required />
                </div>
              </div>

              <div className="ep-coords-row">
                <div className="ep-field">
                  <label className="ep-label">Dest Lat</label>
                  <input className="ep-input" type="number" step="any" value={destLat} onChange={(e) => setDestLat(e.target.value)} placeholder="18.9830" required />
                </div>
                <div className="ep-field">
                  <label className="ep-label">Dest Lng</label>
                  <input className="ep-input" type="number" step="any" value={destLng} onChange={(e) => setDestLng(e.target.value)} placeholder="72.8090" required />
                </div>
              </div>

              {formError && (
                <p className="ep-error">⚠️ {formError}</p>
              )}

              <button
                type="submit"
                className="ep-btn ep-btn--activate"
                disabled={loading}
              >
                {loading ? '⏳ Planning route…' : '🚨 Activate Emergency'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default EmergencyPanel;
