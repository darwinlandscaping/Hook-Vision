import { Router } from "express";

const router = Router();

interface TideEntry {
  time: string;
  type: "HW" | "LW";
  height: number;
  timestamp: number;
}

interface TideDay {
  date: string;
  tides: TideEntry[];
}

interface CacheEntry {
  data: TideDay[];
  fetchedAt: number;
}

// ─── Primary BOM ports (WA) ────────────────────────────────────────────────────
const BOM_PORTS: Record<string, { code: string; name: string }> = {
  broome:      { code: "WA_TP001", name: "Broome" },
  derby:       { code: "WA_TP002", name: "Derby (King Sound)" },
  "port-hedland": { code: "WA_TP003", name: "Port Hedland" },
  exmouth:     { code: "WA_TP004", name: "Exmouth (Learmonth)" },
  carnarvon:   { code: "WA_TP005", name: "Carnarvon" },
  dampier:     { code: "WA_TP006", name: "Dampier" },
  wyndham:     { code: "WA_TP007", name: "Wyndham (Cambridge Gulf)" },
};

// ─── Secondary locations with corrections relative to a primary port ───────────
// offsetMinutes: positive = later than reference port, negative = earlier
// hwFactor / lwFactor: multiply reference port height by this factor
interface LocationCfg {
  name: string;
  refPort: "broome" | "derby" | "port-hedland" | "exmouth" | "carnarvon" | "dampier" | "wyndham";
  offsetMinutes: number;
  hwFactor: number;
  lwFactor: number;
}

const WA_LOCATIONS: Record<string, LocationCfg> = {

  // ── Broome Area (reference: broome) ─────────────────────────────────────────
  "broome-town-beach":  { name: "Broome Town Beach Ramp",         refPort: "broome",       offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "roebuck-bay":        { name: "Roebuck Bay",                     refPort: "broome",       offsetMinutes:  +5, hwFactor: 0.98, lwFactor: 0.97 },
  "cable-beach-ramp":   { name: "Cable Beach Ramp",               refPort: "broome",       offsetMinutes:  -5, hwFactor: 0.97, lwFactor: 0.96 },
  "dampier-creek":      { name: "Dampier Creek Mangroves",         refPort: "broome",       offsetMinutes: +15, hwFactor: 0.93, lwFactor: 0.90 },
  "gantheaume-point":   { name: "Gantheaume Point",               refPort: "broome",       offsetMinutes:  -8, hwFactor: 0.96, lwFactor: 0.95 },

  // ── Derby / King Sound (reference: derby) ────────────────────────────────────
  "derby-jetty":         { name: "Derby Jetty Ramp",              refPort: "derby",        offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "king-sound-mouth":    { name: "King Sound Mouth",              refPort: "derby",        offsetMinutes: -30, hwFactor: 0.92, lwFactor: 0.88 },
  "fitzroy-mouth":       { name: "Fitzroy River Mouth",           refPort: "derby",        offsetMinutes: +25, hwFactor: 0.88, lwFactor: 0.82 },
  "fitzroy-crossing-ramp":{ name: "Fitzroy Crossing Ramp",        refPort: "derby",        offsetMinutes: +180, hwFactor: 0.62, lwFactor: 0.52 },
  "willare-ramp":        { name: "Willare Ramp",                  refPort: "derby",        offsetMinutes: +90, hwFactor: 0.75, lwFactor: 0.68 },

  // ── Ord River / Wyndham (reference: wyndham) ─────────────────────────────────
  "ord-mouth":           { name: "Ord River Mouth (Cambridge Gulf)", refPort: "wyndham",   offsetMinutes:  +5, hwFactor: 0.97, lwFactor: 0.95 },
  "wyndham-ramp":        { name: "Wyndham Boat Ramp",             refPort: "wyndham",      offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "lake-kununurra":      { name: "Lake Kununurra (Ord Stage 1)",  refPort: "wyndham",      offsetMinutes: +480, hwFactor: 0.35, lwFactor: 0.25 },
  "ord-middle-reaches":  { name: "Ord River Middle Reaches",      refPort: "wyndham",      offsetMinutes: +240, hwFactor: 0.55, lwFactor: 0.45 },
  "keep-river":          { name: "Keep River Mouth",              refPort: "wyndham",      offsetMinutes: +30, hwFactor: 0.90, lwFactor: 0.85 },

  // ── North Kimberley / Drysdale (reference: wyndham) ──────────────────────────
  "drysdale-mouth":      { name: "Drysdale River Mouth",          refPort: "wyndham",      offsetMinutes: -30, hwFactor: 0.93, lwFactor: 0.88 },
  "mitchell-river":      { name: "Mitchell River Mouth",          refPort: "wyndham",      offsetMinutes: -45, hwFactor: 0.90, lwFactor: 0.85 },
  "prince-regent":       { name: "Prince Regent River",           refPort: "derby",        offsetMinutes: +60, hwFactor: 0.87, lwFactor: 0.80 },
  "berkeley-sound":      { name: "Berkeley Sound (Vansittart Bay)", refPort: "wyndham",    offsetMinutes: -90, hwFactor: 0.85, lwFactor: 0.78 },
  "king-george-falls":   { name: "King George Falls Area",        refPort: "wyndham",      offsetMinutes: -60, hwFactor: 0.88, lwFactor: 0.82 },

  // ── Port Hedland / Pilbara (reference: port-hedland) ─────────────────────────
  "port-hedland-ramp":   { name: "Port Hedland Boat Ramp",        refPort: "port-hedland", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "de-grey-mouth":       { name: "De Grey River Mouth",           refPort: "port-hedland", offsetMinutes: -20, hwFactor: 0.95, lwFactor: 0.92 },
  "pardoo-station":      { name: "Pardoo Roadhouse Area",         refPort: "port-hedland", offsetMinutes: -35, hwFactor: 0.92, lwFactor: 0.88 },
  "montebello-islands":  { name: "Montebello Islands",            refPort: "dampier",      offsetMinutes: -25, hwFactor: 0.90, lwFactor: 0.88 },

  // ── Exmouth / Ningaloo (reference: exmouth) ───────────────────────────────────
  "exmouth-ramp":        { name: "Exmouth Boat Ramp",             refPort: "exmouth",      offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "exmouth-gulf":        { name: "Exmouth Gulf Flats",            refPort: "exmouth",      offsetMinutes: +20, hwFactor: 0.95, lwFactor: 0.92 },
  "ningaloo-reef":       { name: "Ningaloo Reef (Outside)",       refPort: "exmouth",      offsetMinutes: -15, hwFactor: 0.92, lwFactor: 0.90 },
  "coral-bay":           { name: "Coral Bay Ramp",                refPort: "carnarvon",    offsetMinutes: -30, hwFactor: 0.88, lwFactor: 0.85 },
  "turquoise-bay":       { name: "Turquoise Bay Area",            refPort: "exmouth",      offsetMinutes: -10, hwFactor: 0.93, lwFactor: 0.90 },

  // ── Dampier / Karratha (reference: dampier) ───────────────────────────────────
  "dampier-ramp":        { name: "Dampier Boat Ramp",             refPort: "dampier",      offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "burrup-peninsula":    { name: "Burrup Peninsula",              refPort: "dampier",      offsetMinutes: +10, hwFactor: 0.97, lwFactor: 0.95 },
  "legendre-island":     { name: "Legendre Island",               refPort: "dampier",      offsetMinutes: -20, hwFactor: 0.92, lwFactor: 0.90 },
  "mermaid-sound":       { name: "Mermaid Sound",                 refPort: "dampier",      offsetMinutes: +15, hwFactor: 0.96, lwFactor: 0.94 },
  "roebourne-ramp":      { name: "Roebourne / Point Samson Ramp", refPort: "dampier",      offsetMinutes: -30, hwFactor: 0.90, lwFactor: 0.88 },

  // ── Gascoyne / Carnarvon (reference: carnarvon) ────────────────────────────────
  "carnarvon-ramp":      { name: "Carnarvon Boat Ramp",           refPort: "carnarvon",    offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "gascoyne-mouth":      { name: "Gascoyne River Mouth",          refPort: "carnarvon",    offsetMinutes: +10, hwFactor: 0.97, lwFactor: 0.94 },
  "shark-bay":           { name: "Monkey Mia / Shark Bay",        refPort: "carnarvon",    offsetMinutes: -45, hwFactor: 0.82, lwFactor: 0.78 },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Format a UTC timestamp as WA local time (AWST UTC+8:00)
function formatWATime(timestamp: number): string {
  const offsetMs = 8 * 60 * 60 * 1000; // AWST UTC+8
  const local = new Date(timestamp + offsetMs);
  let h = local.getUTCHours();
  const min = local.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min.toString().padStart(2, "0")} ${ampm}`;
}

// Get the WA local date string "YYYY-MM-DD" for a UTC timestamp
function getWADate(timestamp: number): string {
  const offsetMs = 8 * 60 * 60 * 1000;
  const local = new Date(timestamp + offsetMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Apply secondary port corrections
function applyCorrection(
  tides: TideDay[],
  offsetMinutes: number,
  hwFactor: number,
  lwFactor: number,
): TideDay[] {
  const offsetMs = offsetMinutes * 60 * 1000;

  const all: TideEntry[] = tides.flatMap((d) =>
    d.tides.map((t) => ({
      timestamp: t.timestamp + offsetMs,
      time: formatWATime(t.timestamp + offsetMs),
      type: t.type,
      height: parseFloat(
        (t.height * (t.type === "HW" ? hwFactor : lwFactor)).toFixed(2)
      ),
    }))
  );

  const grouped = new Map<string, TideDay>();
  for (const t of all) {
    const date = getWADate(t.timestamp);
    if (!grouped.has(date)) grouped.set(date, { date, tides: [] });
    grouped.get(date)!.tides.push(t);
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

// ─── BOM HTML parser ───────────────────────────────────────────────────────────
function parseBomHtml(html: string): TideDay[] {
  const result: Map<string, TideDay> = new Map();

  const MONTHS: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05",     june: "06",     july: "07",  august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };

  const summaryRe =
    /summary="[^"]*?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})"/gi;
  let m: RegExpExecArray | null;
  while ((m = summaryRe.exec(html)) !== null) {
    const dateStr = `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
    if (!result.has(dateStr)) result.set(dateStr, { date: dateStr, tides: [] });
  }

  const tideRe =
    /data-time-utc="([^"]+)"\s+data-time-local="(\d{4}-\d{2}-\d{2})[^"]*"\s+class="localtime\s+(low|high)-tide">([^<]+)<\/td>[\s\S]*?<td[^>]+class="height[^"]*">([\d.]+)\s*m/gi;

  while ((m = tideRe.exec(html)) !== null) {
    const utcIso = m[1];
    const localDate = m[2];
    const tideTypeWord = m[3];
    const localTimeText = m[4].trim();
    const height = parseFloat(m[5]);
    const timestamp = new Date(utcIso).getTime();
    const type: "HW" | "LW" = tideTypeWord === "high" ? "HW" : "LW";
    const [timePart, ampm] = localTimeText.split(" ");
    const displayTime = `${timePart} ${(ampm || "").toUpperCase()}`;

    if (!result.has(localDate)) result.set(localDate, { date: localDate, tides: [] });
    result.get(localDate)!.tides.push({ time: displayTime, type, height, timestamp });
  }

  for (const day of result.values()) {
    day.tides.sort((a, b) => a.timestamp - b.timestamp);
  }

  return Array.from(result.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Cache ─────────────────────────────────────────────────────────────────────
const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 60 * 60 * 1000;

async function fetchBomTides(portCode: string, days: number): Promise<TideDay[]> {
  const cacheKey = `${portCode}-${days}`;
  const now = Date.now();
  if (cache[cacheKey] && now - cache[cacheKey].fetchedAt < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  const waDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  const url = new URL("https://www.bom.gov.au/australia/tides/print.php");
  url.searchParams.set("aac", portCode);
  url.searchParams.set("type", "tide");
  url.searchParams.set("date", waDate);
  url.searchParams.set("region", "WA");
  url.searchParams.set("tz", "Australia/Perth");
  url.searchParams.set("days", String(days));

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-AU,en;q=0.9",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`BOM returned HTTP ${res.status}`);

  const html = await res.text();
  const parsed = parseBomHtml(html);
  if (parsed.length === 0 || parsed.every((d) => d.tides.length === 0)) {
    throw new Error("Tide data unavailable from BOM. Try again later.");
  }

  cache[cacheKey] = { data: parsed, fetchedAt: now };
  return parsed;
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// GET /api/tides?port=broome&days=3   (primary BOM ports)
// GET /api/tides?location=fitzroy-mouth&days=3  (secondary with corrections)
router.get("/tides", async (req, res) => {
  const days = Math.min(parseInt((req.query["days"] as string) || "3", 10), 5);
  const locationId = req.query["location"] as string | undefined;
  const portKey = ((req.query["port"] as string) || "broome").toLowerCase();

  try {
    if (locationId) {
      const loc = WA_LOCATIONS[locationId];
      if (!loc) {
        res.status(400).json({ error: `Unknown location: ${locationId}` });
        return;
      }
      const port = BOM_PORTS[loc.refPort];
      const rawTides = await fetchBomTides(port.code, days + 1);
      const corrected = applyCorrection(rawTides, loc.offsetMinutes, loc.hwFactor, loc.lwFactor);
      const todayWA = getWADate(Date.now());
      const filtered = corrected.filter((d) => d.date >= todayWA).slice(0, days);
      res.json({ port: loc.name, portKey: locationId, data: filtered, isSecondary: true, refPort: loc.refPort });
      return;
    }

    const port = BOM_PORTS[portKey];
    if (!port) {
      res.status(400).json({ error: `Unknown port. Use ?location=ID or ?port=${Object.keys(BOM_PORTS).join("|")}` });
      return;
    }
    const data = await fetchBomTides(port.code, days);
    res.json({ port: port.name, portKey, data, isSecondary: false });

  } catch (err) {
    req.log.error({ err }, "BOM tides fetch failed");
    res.status(502).json({
      error: err instanceof Error ? err.message : "Could not fetch tide data from Bureau of Meteorology.",
    });
  }
});

// GET /api/tides/locations  — returns all WA locations
router.get("/tides/locations", (_req, res) => {
  res.json(
    Object.entries(WA_LOCATIONS).map(([id, loc]) => ({
      id,
      name: loc.name,
      refPort: loc.refPort,
      offsetMinutes: loc.offsetMinutes,
    }))
  );
});

export default router;
