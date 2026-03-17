import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Fetches all junctions from the REST API on mount.
 * Returns { junctions, loading, error }
 */
const useJunctions = () => {
  const [junctions, setJunctions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/junctions`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setJunctions(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load junctions:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { junctions, loading, error };
};

export default useJunctions;
