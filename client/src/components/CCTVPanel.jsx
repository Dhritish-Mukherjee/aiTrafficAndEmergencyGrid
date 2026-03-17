import { useState, useEffect, useRef, useCallback } from 'react';
import './CCTVPanel.css';

const AI_SERVICE_URL = 'http://localhost:5001';

// Poll faster than the AI worker's ~66ms frame period.
// Frame dedup via X-Frame-Counter skips unchanged frames.
// Stats come from the SAME response headers as the JPEG, so they
// are always perfectly in sync — no more "3 boxes but 7 vehicles".
const POLL_MS = 50;

const DENSITY_COLORS = {
  LOW:      '#22c55e',
  MODERATE: '#f59e0b',
  HIGH:     '#f97316',
  SEVERE:   '#ef4444',
};

// ── useCanvasStream ───────────────────────────────────────────────────────────

const useCanvasStream = (junctionId, canvasRef, onFrameData) => {
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState(false);

  useEffect(() => {
    // *** LOCAL active flag — not a shared ref ***
    // This is the critical fix for ghost poll loops.
    // When junctionId changes, React runs this cleanup first, setting
    // active=false. Any in-flight async fetch from the OLD effect checks
    // its own local `active` (which is now false) and stops — the NEW
    // effect's `active` is a completely separate variable starting at true.
    let active       = true;
    let timerId      = null;
    let fetching     = false;
    let lastCounter  = -1;
    let errorCount   = 0;

    setConnected(false);
    setError(false);

    const drawBlob = (blob) => {
      if (!active || !canvasRef.current) return;
      const blobUrl = URL.createObjectURL(blob);
      const img     = new Image();
      img.onload = () => {
        if (!active || !canvasRef.current) { URL.revokeObjectURL(blobUrl); return; }
        canvasRef.current.getContext('2d').drawImage(
          img, 0, 0, canvasRef.current.width, canvasRef.current.height
        );
        URL.revokeObjectURL(blobUrl);
        setConnected(true);
        setError(false);
        errorCount = 0;
      };
      img.onerror = () => URL.revokeObjectURL(blobUrl);
      img.src = blobUrl;
    };

    const poll = async () => {
      if (!active) return;

      if (!fetching) {
        fetching = true;
        try {
          const res = await fetch(
            `${AI_SERVICE_URL}/frame/${junctionId}?t=${Date.now()}`
          );
          if (!active) { fetching = false; return; }

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const counter = parseInt(res.headers.get('X-Frame-Counter') || '0', 10);

          if (counter !== lastCounter) {
            lastCounter = counter;

            // Read stats from response headers — perfectly in sync with the JPEG
            const vehicleCount = parseInt(res.headers.get('X-Vehicle-Count') || '0', 10);
            const classesRaw   = res.headers.get('X-Classes') || '{}';
            let classes = {};
            try { classes = JSON.parse(classesRaw); } catch (_) {}

            onFrameData({ vehicle_count: vehicleCount, classes });

            const blob = await res.blob();
            if (active) drawBlob(blob);
          }
        } catch {
          if (active) {
            errorCount++;
            if (errorCount >= 3) { setError(true); setConnected(false); }
          }
        } finally {
          fetching = false;
        }
      }

      if (active) timerId = setTimeout(poll, POLL_MS);
    };

    poll();

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  // onFrameData is stable (useCallback), junctionId drives the restart
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [junctionId]);

  return { connected, error };
};

// ── CCTVPanel component ────────────────────────────────────────────────────────

const CCTVPanel = ({ junction, onClose }) => {
  const canvasRef              = useRef(null);
  const [liveData, setLiveData]= useState(null);

  // Stable callback so the hook's dependency array stays clean
  const onFrameData = useCallback((data) => setLiveData(data), []);

  const { connected, error } = useCanvasStream(
    junction?._id,
    canvasRef,
    onFrameData,
  );

  // Reset stats when junction changes
  useEffect(() => {
    setLiveData(null);
  }, [junction?._id]);

  if (!junction) return null;

  const density      = liveData?.vehicle_count ?? 0;
  const classes      = liveData?.classes ?? {};
  const densityScore = Math.min(Math.round((density / 50) * 100), 100);
  const densityLevel =
    density > 40 ? 'SEVERE'   :
    density > 25 ? 'HIGH'     :
    density > 10 ? 'MODERATE' : 'LOW';
  const levelColor = DENSITY_COLORS[densityLevel];

  return (
    <div className="cctv-panel" id="cctv-panel">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="cctv-header">
        <div className="cctv-header-info">
          <span className="cctv-icon">📷</span>
          <div>
            <h3 className="cctv-title">{junction.name}</h3>
            <span className="cctv-subtitle">Live CCTV · AI Detection</span>
          </div>
        </div>
        <button
          className="cctv-close"
          onClick={onClose}
          aria-label="Close CCTV panel"
          id="cctv-close-btn"
        >
          ✕
        </button>
      </div>

      {/* ── Video canvas ─────────────────────────────────────────────────── */}
      <div className="cctv-stream-wrapper">

        {error && (
          <div className="cctv-stream-error">
            <span className="cctv-stream-error-icon">⚠️</span>
            <p>Stream unavailable</p>
            <p className="cctv-stream-error-sub">
              Ensure Python AI service is running on port 5001
            </p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          id={`cctv-canvas-${junction._id}`}
          className={`cctv-canvas${error ? ' cctv-canvas--hidden' : ''}`}
          width={640}
          height={480}
        />

        {!connected && !error && (
          <div className="cctv-stream-loading">
            <div className="cctv-stream-spinner" />
            <span>Connecting to AI stream…</span>
          </div>
        )}

        <div className={`cctv-stream-badge${connected ? ' cctv-stream-badge--on' : ''}`}>
          <span className="cctv-live-dot" />
          LIVE · AI
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="cctv-stats">

        <div className="cctv-stat-card cctv-stat-main">
          <div className="cctv-stat-value" style={{ color: levelColor }}>
            {density}
          </div>
          <div className="cctv-stat-label">Vehicles detected</div>
          <div className="cctv-density-badge" style={{ background: levelColor }}>
            {densityLevel}
          </div>
        </div>

        <div className="cctv-density-bar-wrap">
          <div className="cctv-density-bar-label">
            <span>Traffic density</span>
            <span style={{ color: levelColor, fontWeight: 700 }}>{densityScore}%</span>
          </div>
          <div className="cctv-density-bar-bg">
            <div
              className="cctv-density-bar-fill"
              style={{ width: `${densityScore}%`, background: levelColor }}
            />
          </div>
        </div>

        {Object.keys(classes).length > 0 ? (
          <div className="cctv-classes">
            <div className="cctv-classes-title">🔍 Detected classes</div>
            <div className="cctv-classes-grid">
              {Object.entries(classes).map(([cls, cnt]) => (
                <div key={cls} className="cctv-class-chip">
                  <span className="cctv-class-icon">
                    {cls === 'car'        ? '🚗' :
                     cls === 'bus'        ? '🚌' :
                     cls === 'motorcycle' ? '🏍️' :
                     cls === 'truck'      ? '🚛' : '🚐'}
                  </span>
                  <span className="cctv-class-name">{cls}</span>
                  <span className="cctv-class-count">{cnt}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="cctv-no-data">
            {connected ? 'Awaiting YOLO class data…' : 'Connecting to Python AI service…'}
          </p>
        )}
      </div>
    </div>
  );
};

export default CCTVPanel;
