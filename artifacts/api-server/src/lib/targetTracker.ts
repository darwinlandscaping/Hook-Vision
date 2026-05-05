/**
 * Target Tracker — persistent fish ID continuity across burst frames
 *
 * Keeps in-memory position history per fishing session. When a new detection
 * arrives, matches it against recent tracked targets using centroid distance.
 * If a match is found → reuses the same trackId (e.g. "barra-1").
 * Otherwise → assigns the next sequential ID for that label class.
 *
 * Also computes a velocity vector (dx, dy) in normalised coords per frame
 * from the last two recorded positions. Used for movement arrows + prediction.
 */

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PositionSample {
  cx: number;
  cy: number;
  burst: number;
  frame: number;
}

interface TrackedTarget {
  trackId: string;
  label: string;
  history: PositionSample[];
  lastBurst: number;
  lastFrame: number;
}

const MAX_HISTORY = 6;
const MATCH_THRESHOLD = 0.28; // normalised coord distance — within ~28% of frame = same target

const sessionTracks  = new Map<number, Map<string, TrackedTarget>>();
const labelCounters  = new Map<number, Map<string, number>>();

function centroid(b: BBox): { cx: number; cy: number } {
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}

function dist(a: { cx: number; cy: number }, b: { cx: number; cy: number }): number {
  return Math.sqrt((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2);
}

function normaliseLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("barra") || l.includes("lates")) return "barra";
  if (l.includes("croc"))   return "croc";
  if (l.includes("person") || l.includes("human") || l.includes("face")) return "person";
  if (l.includes("trevally")) return "trev";
  if (l.includes("queenfish")) return "queen";
  if (l.includes("mackerel")) return "mack";
  if (l.includes("salmon")) return "salm";
  if (l.includes("jack")) return "jack";
  return l.replace(/\s+/g, "_").slice(0, 6);
}

/**
 * Match an incoming detection to an existing track or assign a new ID.
 * Returns the trackId and computed velocity (null if fewer than 2 samples).
 */
export function matchOrAssign(
  sessionId: number,
  burstNum: number,
  frameNum: number,
  label: string,
  box: BBox,
): { trackId: string; velocity: { dx: number; dy: number } | null } {
  if (!sessionTracks.has(sessionId)) {
    sessionTracks.set(sessionId, new Map());
    labelCounters.set(sessionId, new Map());
  }
  const tracks   = sessionTracks.get(sessionId)!;
  const counters = labelCounters.get(sessionId)!;
  const lnorm    = normaliseLabel(label);
  const newC     = centroid(box);

  // Find closest existing track of the same normalised label class
  let bestId: string | null = null;
  let bestD = MATCH_THRESHOLD;

  for (const [tid, track] of tracks) {
    if (normaliseLabel(track.label) !== lnorm) continue;
    const last = track.history.at(-1);
    if (!last) continue;
    const d = dist({ cx: last.cx, cy: last.cy }, newC);
    if (d < bestD) { bestD = d; bestId = tid; }
  }

  let trackId: string;
  if (bestId) {
    trackId = bestId;
  } else {
    const count = (counters.get(lnorm) ?? 0) + 1;
    counters.set(lnorm, count);
    trackId = `${lnorm}-${count}`;
  }

  // Append to history
  const existing = tracks.get(trackId) ?? { trackId, label, history: [], lastBurst: burstNum, lastFrame: frameNum };
  const history = [...existing.history, { cx: newC.cx, cy: newC.cy, burst: burstNum, frame: frameNum }];
  if (history.length > MAX_HISTORY) history.shift();
  tracks.set(trackId, { trackId, label, history, lastBurst: burstNum, lastFrame: frameNum });

  // Velocity: displacement from second-to-last position
  let velocity: { dx: number; dy: number } | null = null;
  if (history.length >= 2) {
    const prev = history.at(-2)!;
    const curr = history.at(-1)!;
    velocity = { dx: curr.cx - prev.cx, dy: curr.cy - prev.cy };
  }

  return { trackId, velocity };
}

/** Call when the session ends to free memory. */
export function endSession(sessionId: number): void {
  sessionTracks.delete(sessionId);
  labelCounters.delete(sessionId);
}

// Prune very old sessions (cap at 200 to guard against memory leaks on long shifts)
setInterval(() => {
  if (sessionTracks.size > 200) {
    const keys = [...sessionTracks.keys()].slice(0, 100);
    keys.forEach(k => { sessionTracks.delete(k); labelCounters.delete(k); });
  }
}, 20 * 60 * 1000);
