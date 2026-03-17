import useJunctions from './hooks/useJunctions';
import TrafficMap from './components/TrafficMap';
import StatsBar from './components/StatsBar';
import './App.css';

function App() {
  const { junctions, loading, error } = useJunctions();

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
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1 className="dashboard-title">🚦 AI Traffic &amp; Emergency Grid</h1>
          <p className="dashboard-subtitle">Mumbai · Live Signal Intelligence</p>
        </div>
        <div className="dashboard-header-right">
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

      {/* Map */}
      <section className="dashboard-map">
        <TrafficMap initialJunctions={junctions} />
      </section>
    </div>
  );
}

export default App;
