import { useRef, useState } from 'react';
import useJunctions from './hooks/useJunctions';
import useEmergency from './hooks/useEmergency';
import TrafficMap from './components/TrafficMap';
import StatsBar from './components/StatsBar';
import EmergencyPanel from './components/EmergencyPanel';
import Toast from './components/Toast';
import './App.css';

function App() {
  const { junctions, loading, error } = useJunctions();

  const { emergencyState, activate, deactivate, toast, loading: eLoading, formError } =
    useEmergency();

  if (loading) {
    return (
      <div className="app-state">
        <div className="spinner" />
        <p>Connecting to AI Traffic Grid…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-state app-state--error">
        <p>⚠️ Failed to load junctions: {error}</p>
        <p>Make sure the backend is running on port 5000.</p>
      </div>
    );
  }

  return (
    <div className={`dashboard ${emergencyState.active ? 'dashboard--emergency' : ''}`}>
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1 className="dashboard-title">🚦 AI Traffic &amp; Emergency Grid</h1>
          <p className="dashboard-subtitle">Mumbai · Live Signal Intelligence</p>
        </div>
        <div className="dashboard-header-right">
          {emergencyState.active && (
            <div className="live-indicator live-indicator--emergency">
              <span className="live-dot live-dot--red" />
              EMERGENCY
            </div>
          )}
          <div className="live-indicator">
            <span className="live-dot" />
            LIVE
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="dashboard-stats">
        <StatsBar initialJunctions={junctions} />
      </section>

      {/* Map + side panel */}
      <section className="dashboard-main">
        <div className="dashboard-map">
          <TrafficMap
            initialJunctions={junctions}
            emergencyState={emergencyState}
          />
        </div>

        <aside className="dashboard-sidebar">
          <EmergencyPanel
            emergencyState={emergencyState}
            activate={activate}
            deactivate={deactivate}
            loading={eLoading}
            formError={formError}
          />
        </aside>
      </section>

      {/* Toast notifications */}
      <Toast toast={toast} />
    </div>
  );
}

export default App;
