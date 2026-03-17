import { useState, useCallback, useRef } from 'react';
import useSocket from './useSocket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const INITIAL_STATE = {
  active: false,
  eventId: null,
  vehicleId: null,
  ambulancePos: null,          // { lat, lng }
  corridorJunctionIds: new Set(),
  corridorPositions: [],       // [{ lat, lng }] ordered for Polyline
  startedAt: null,
};

/**
 * Manages the full lifecycle of an emergency event.
 * Exposes: emergencyState, activate(), deactivate(), toast
 */
const useEmergency = (junctionMap = {}) => {
  const [state, setState] = useState(INITIAL_STATE);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Show a toast message for N ms
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Socket: emergency activated ──────────────────────────────────────────────
  const onActivated = useCallback((data) => {
    // Build corridor positions from junctionMap (already loaded in TrafficMap)
    const corridorPositions = data.corridorJunctions
      .map((id) => junctionMap[id]?.location)
      .filter(Boolean)
      .map((loc) => ({ lat: loc.lat, lng: loc.lng }));

    // Add origin as first position
    if (data.origin) {
      corridorPositions.unshift({ lat: data.origin.lat, lng: data.origin.lng });
    }

    setState({
      active: true,
      eventId: data.eventId,
      vehicleId: data.vehicleId,
      ambulancePos: data.origin,
      corridorJunctionIds: new Set(data.corridorJunctions),
      corridorPositions,
      startedAt: Date.now(),
    });

    showToast(`🚨 Emergency activated! Corridor: ${data.junctionNames.join(' → ')}`, 'emergency');
  }, [junctionMap]);

  // ── Socket: ambulance location ping ─────────────────────────────────────────
  const onLocation = useCallback((data) => {
    setState((prev) => ({
      ...prev,
      ambulancePos: { lat: data.lat, lng: data.lng },
    }));
  }, []);

  // ── Socket: emergency cleared ────────────────────────────────────────────────
  const onCleared = useCallback((data) => {
    setState(INITIAL_STATE);
    const mins = Math.floor(data.responseTimeSecs / 60);
    const secs = data.responseTimeSecs % 60;
    showToast(
      `✅ Corridor cleared! Response time: ${mins > 0 ? `${mins}m ` : ''}${secs}s`,
      'success'
    );
  }, []);

  useSocket({
    'emergency:activated': onActivated,
    'emergency:location':  onLocation,
    'emergency:cleared':   onCleared,
  });

  // ── Activate (REST call) ─────────────────────────────────────────────────────
  const activate = async ({ vehicleId, origin, destination }) => {
    setLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_URL}/api/emergency/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, origin, destination }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Activation failed');
      // Socket event will update state
    } catch (err) {
      setFormError(err.message);
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Deactivate (REST call) ───────────────────────────────────────────────────
  const deactivate = async () => {
    if (!state.eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/emergency/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: state.eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Deactivation failed');
      // Socket event will clear state
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return { emergencyState: state, activate, deactivate, toast, loading, formError };
};

export default useEmergency;
