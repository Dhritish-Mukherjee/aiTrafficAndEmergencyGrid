const Junction = require('../models/Junction');

// ─── Haversine Distance (km) ──────────────────────────────────────────────────
const haversine = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const angle =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
};

// ─── Find junction in flat array closest to a lat/lng point ──────────────────
const nearestJunction = (junctions, point) => {
  let best = null;
  let bestDist = Infinity;
  for (const j of junctions) {
    const d = haversine(j.location, point);
    if (d < bestDist) {
      bestDist = d;
      best = j;
    }
  }
  return best;
};

// ─── A* Search ────────────────────────────────────────────────────────────────
/**
 * Runs A* over the junction graph to find the shortest path.
 *
 * @param {Map<string, Junction>}   junctionById  - All junctions indexed by _id string
 * @param {Junction}                start
 * @param {Junction}                goal
 * @returns {string[]} Ordered array of junction _id strings, or [] if no path found
 */
const aStar = (junctionById, start, goal) => {
  const goalLoc = goal.location;

  // Priority queue: [{f, g, id, path}]
  const openSet = [{
    f: 0,
    g: 0,
    id: start._id.toString(),
    path: [start._id.toString()],
  }];

  const visited = new Set();

  while (openSet.length > 0) {
    // Pop the node with smallest f
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();

    if (current.id === goal._id.toString()) {
      return current.path; // Found!
    }

    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const currentJunction = junctionById.get(current.id);
    if (!currentJunction || !currentJunction.neighbours) continue;

    for (const neighbourId of currentJunction.neighbours) {
      const nid = neighbourId.toString();
      if (visited.has(nid)) continue;

      const neighbour = junctionById.get(nid);
      if (!neighbour) continue;

      // g = actual cost (km from start → neighbour)
      const g = current.g + haversine(currentJunction.location, neighbour.location);
      // h = heuristic (straight-line distance to goal)
      const h = haversine(neighbour.location, goalLoc);
      const f = g + h;

      openSet.push({
        f,
        g,
        id: nid,
        path: [...current.path, nid],
      });
    }
  }

  return []; // No path found
};

// ─── Main Export ──────────────────────────────────────────────────────────────
/**
 * Plans an emergency corridor between two GPS coordinates.
 *
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {{ path: string[], junctions: Junction[] }} ordered path of junctionIds + their documents
 */
const planCorridor = async (origin, destination) => {
  // Fetch all junctions (with neighbours populated so we traverse by name if needed)
  const allJunctions = await Junction.find({});

  if (allJunctions.length === 0) {
    throw new Error('No junctions in database. Run seed.js first.');
  }

  // Build an O(1) lookup map
  const junctionById = new Map();
  for (const j of allJunctions) {
    junctionById.set(j._id.toString(), j);
  }

  // Find start and end junctions by closest Haversine distance
  const startJunction = nearestJunction(allJunctions, origin);
  const endJunction   = nearestJunction(allJunctions, destination);

  if (startJunction._id.toString() === endJunction._id.toString()) {
    // Origin and destination map to the same junction
    return {
      path: [startJunction._id.toString()],
      junctions: [startJunction],
    };
  }

  // Run A*
  const path = aStar(junctionById, startJunction, endJunction);

  if (path.length === 0) {
    throw new Error(
      `No route found between "${startJunction.name}" and "${endJunction.name}". ` +
      `Check that junctions have neighbours[] populated.`
    );
  }

  const junctions = path.map((id) => junctionById.get(id));

  return { path, junctions };
};

module.exports = { planCorridor, haversine, nearestJunction };
