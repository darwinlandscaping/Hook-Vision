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

// ─── Primary BOM ports ─────────────────────────────────────────────────────────
const BOM_PORTS: Record<string, { code: string; name: string }> = {
  darwin: { code: "NT_TP001", name: "Darwin" },
  gove:   { code: "NT_TP002", name: "Gove (Nhulunbuy)" },
  groote: { code: "NT_TP003", name: "Groote Eylandt (Alyangula)" },
  // ── NQ / Gulf Country ───────────────────────────────────────────────────────
  karumba:  { code: "QLD_TP001", name: "Karumba" },
  weipa:    { code: "QLD_TP002", name: "Weipa" },
  cairns:   { code: "QLD_TP003", name: "Cairns" },
  cooktown: { code: "QLD_TP004", name: "Cooktown" },
};

// ─── Secondary locations with corrections relative to a primary port ───────────
// offsetMinutes: positive = later than reference port, negative = earlier
// hwFactor / lwFactor: multiply reference port height by this factor
interface LocationCfg {
  name: string;
  refPort: "darwin" | "gove" | "groote" | "karumba" | "weipa" | "cairns" | "cooktown";
  offsetMinutes: number;
  hwFactor: number;
  lwFactor: number;
}

const NT_LOCATIONS: Record<string, LocationCfg> = {
  // ── Darwin Area (reference: darwin, no correction) ─────────────────────────
  "darwin-city":        { name: "Darwin City (Stokes Hill Ramp)", refPort: "darwin", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "fannie-bay":         { name: "Fannie Bay Boat Ramp",           refPort: "darwin", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "cullen-bay":         { name: "Cullen Bay Marina",              refPort: "darwin", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "nightcliff":         { name: "Nightcliff Boat Ramp",           refPort: "darwin", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "lee-point":          { name: "Lee Point Beach",                refPort: "darwin", offsetMinutes:  -5, hwFactor: 1.00, lwFactor: 1.00 },
  "mandorah":           { name: "Mandorah Boat Ramp",             refPort: "darwin", offsetMinutes: -10, hwFactor: 1.02, lwFactor: 1.00 },
  "cox-peninsula":      { name: "Cox Peninsula Ramp",             refPort: "darwin", offsetMinutes: -15, hwFactor: 1.02, lwFactor: 1.01 },
  "bynoe-harbour":      { name: "Bynoe Harbour Ramp",             refPort: "darwin", offsetMinutes: +20, hwFactor: 1.01, lwFactor: 1.00 },
  "gunn-point":         { name: "Gunn Point Beach",               refPort: "darwin", offsetMinutes:  -5, hwFactor: 1.01, lwFactor: 1.00 },
  "east-arm":           { name: "East Arm Wharf",                 refPort: "darwin", offsetMinutes:  +5, hwFactor: 1.00, lwFactor: 1.00 },

  // ── Adelaide River ─────────────────────────────────────────────────────────
  "adelaide-mouth":     { name: "Adelaide River Mouth",           refPort: "darwin", offsetMinutes:  +5, hwFactor: 0.97, lwFactor: 0.95 },
  "point-stuart":       { name: "Point Stuart Boat Ramp",         refPort: "darwin", offsetMinutes: +20, hwFactor: 0.97, lwFactor: 0.94 },
  "window-wetlands":    { name: "Window on the Wetlands",         refPort: "darwin", offsetMinutes: +30, hwFactor: 0.95, lwFactor: 0.90 },
  "annaburroo":         { name: "Annaburroo Ramp (Adelaide R.)",  refPort: "darwin", offsetMinutes: +40, hwFactor: 0.92, lwFactor: 0.86 },

  // ── Mary River ─────────────────────────────────────────────────────────────
  "mary-mouth":         { name: "Mary River Mouth (Pt Ragged)",   refPort: "darwin", offsetMinutes: +10, hwFactor: 0.97, lwFactor: 0.95 },
  "shady-camp":         { name: "Shady Camp Rock Bar ★",          refPort: "darwin", offsetMinutes: +15, hwFactor: 0.96, lwFactor: 0.93 },
  "shady-camp-ramp":    { name: "Shady Camp Boat Ramp",           refPort: "darwin", offsetMinutes: +15, hwFactor: 0.96, lwFactor: 0.93 },
  "corroboree":         { name: "Corroboree Billabong (Mary R.)", refPort: "darwin", offsetMinutes: +40, hwFactor: 0.90, lwFactor: 0.82 },
  "marrakai":           { name: "Marrakai Boat Ramp",             refPort: "darwin", offsetMinutes: +45, hwFactor: 0.88, lwFactor: 0.80 },

  // ── Daly River ─────────────────────────────────────────────────────────────
  "daly-mouth":         { name: "Daly River Mouth",               refPort: "darwin", offsetMinutes: +45, hwFactor: 0.93, lwFactor: 0.85 },
  "snake-creek":        { name: "Snake Creek Ramp (Daly R.)",     refPort: "darwin", offsetMinutes: +65, hwFactor: 0.88, lwFactor: 0.78 },
  "woolianna":          { name: "Woolianna Boat Ramp (Daly R.)",  refPort: "darwin", offsetMinutes: +90, hwFactor: 0.85, lwFactor: 0.74 },
  "daly-river-town":    { name: "Daly River Town Ramp",           refPort: "darwin", offsetMinutes:+120, hwFactor: 0.78, lwFactor: 0.65 },
  "port-keats":         { name: "Wadeye (Port Keats) Ramp",       refPort: "darwin", offsetMinutes:+175, hwFactor: 0.82, lwFactor: 0.70 },

  // ── Kakadu / Alligator Rivers ───────────────────────────────────────────────
  "south-alligator":    { name: "South Alligator Mouth",          refPort: "darwin", offsetMinutes: +10, hwFactor: 0.96, lwFactor: 0.93 },
  "field-island":       { name: "Field Island (S. Alligator)",    refPort: "darwin", offsetMinutes:  +5, hwFactor: 0.97, lwFactor: 0.95 },
  "cahills-crossing":   { name: "Cahills Crossing Rock Bar ★",    refPort: "darwin", offsetMinutes: +35, hwFactor: 0.90, lwFactor: 0.82 },
  "east-alligator":     { name: "East Alligator River Mouth",     refPort: "darwin", offsetMinutes: +25, hwFactor: 0.93, lwFactor: 0.88 },
  "west-alligator":     { name: "West Alligator River Mouth",     refPort: "darwin", offsetMinutes:  +5, hwFactor: 0.97, lwFactor: 0.94 },

  // ── Port Essington / Cobourg ────────────────────────────────────────────────
  "port-essington":     { name: "Port Essington",                 refPort: "darwin", offsetMinutes: +30, hwFactor: 0.92, lwFactor: 0.85 },
  "cobourg":            { name: "Cobourg Peninsula",              refPort: "darwin", offsetMinutes: +25, hwFactor: 0.93, lwFactor: 0.86 },
  "smith-point":        { name: "Smith Point (Cobourg)",          refPort: "darwin", offsetMinutes: +20, hwFactor: 0.93, lwFactor: 0.87 },

  // ── Victoria River & West ───────────────────────────────────────────────────
  "victoria-mouth":     { name: "Victoria River Mouth",           refPort: "darwin", offsetMinutes:+160, hwFactor: 0.85, lwFactor: 0.72 },
  "big-horse-creek":    { name: "Big Horse Creek Ramp (Vic. R.)", refPort: "darwin", offsetMinutes:+190, hwFactor: 0.80, lwFactor: 0.68 },
  "baines-river":       { name: "Baines River Mouth",             refPort: "darwin", offsetMinutes:+155, hwFactor: 0.86, lwFactor: 0.73 },

  // ── Arnhem Land (reference: gove) ──────────────────────────────────────────
  "nhulunbuy-ramp":     { name: "Nhulunbuy (Gove) Boat Ramp",    refPort: "gove",   offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "melville-bay":       { name: "Melville Bay (Gove)",            refPort: "gove",   offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "caledon-bay":        { name: "Caledon Bay",                    refPort: "gove",   offsetMinutes: +30, hwFactor: 0.95, lwFactor: 0.90 },
  "trial-bay":          { name: "Trial Bay (Arnhem Land)",        refPort: "gove",   offsetMinutes: +20, hwFactor: 0.97, lwFactor: 0.94 },
  "buckingham-bay":     { name: "Buckingham Bay",                 refPort: "gove",   offsetMinutes: +45, hwFactor: 0.92, lwFactor: 0.88 },
  "elcho-island":       { name: "Elcho Island (Galiwinku)",       refPort: "gove",   offsetMinutes: -30, hwFactor: 0.82, lwFactor: 0.75 },
  "milingimbi":         { name: "Milingimbi",                     refPort: "gove",   offsetMinutes: -45, hwFactor: 0.80, lwFactor: 0.72 },
  "maningrida":         { name: "Maningrida (Liverpool River)",   refPort: "darwin", offsetMinutes: -20, hwFactor: 0.75, lwFactor: 0.68 },

  // ── Groote Eylandt (reference: groote) ────────────────────────────────────
  "alyangula":          { name: "Alyangula Boat Ramp",            refPort: "groote", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "emerald-river":      { name: "Emerald River Mouth",            refPort: "groote", offsetMinutes: +20, hwFactor: 0.90, lwFactor: 0.85 },
  "umbakumba":          { name: "Umbakumba Ramp (Groote E.)",     refPort: "groote", offsetMinutes: +45, hwFactor: 0.88, lwFactor: 0.82 },
  "bartalumba-bay":     { name: "Bartalumba Bay",                 refPort: "groote", offsetMinutes: +15, hwFactor: 0.92, lwFactor: 0.88 },
  "winchelsea":         { name: "Winchelsea Island (Groote E.)",  refPort: "groote", offsetMinutes: +30, hwFactor: 0.90, lwFactor: 0.85 },

  // ── Gulf Coast (reference: groote) ────────────────────────────────────────
  "king-ash-bay":       { name: "King Ash Bay Ramp (Borroloola)", refPort: "groote", offsetMinutes:+120, hwFactor: 0.90, lwFactor: 0.85 },
  "mcarthur-mouth":     { name: "McArthur River Mouth",           refPort: "groote", offsetMinutes: +60, hwFactor: 0.93, lwFactor: 0.90 },
  "roper-mouth":        { name: "Roper River Mouth",              refPort: "groote", offsetMinutes:+120, hwFactor: 0.80, lwFactor: 0.72 },
  "roper-bar":          { name: "Roper Bar Rock Bar ★",           refPort: "groote", offsetMinutes:+240, hwFactor: 0.70, lwFactor: 0.60 },
  "nathan-river":       { name: "Nathan River Mouth",             refPort: "groote", offsetMinutes: +90, hwFactor: 0.88, lwFactor: 0.80 },
  "robinson-river":     { name: "Robinson River Mouth",           refPort: "groote", offsetMinutes:+100, hwFactor: 0.86, lwFactor: 0.78 },
};

// ─── NQ / Gulf Country secondary locations ──────────────────────────────────────
// All relative to primary BOM ports above
const NQ_LOCATIONS: Record<string, LocationCfg> = {
  // ── Gulf of Carpentaria (reference: karumba) ───────────────────────────────
  "karumba-point":      { name: "Karumba Point Boat Ramp",       refPort: "karumba", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "norman-river-mouth": { name: "Norman River Mouth Bar ★",       refPort: "karumba", offsetMinutes:  +5, hwFactor: 0.98, lwFactor: 0.96 },
  "normanton":          { name: "Normanton Wharf (Norman R.)",    refPort: "karumba", offsetMinutes: +45, hwFactor: 0.85, lwFactor: 0.75 },
  "flinders-mouth":     { name: "Flinders River Mouth",           refPort: "karumba", offsetMinutes: +15, hwFactor: 0.96, lwFactor: 0.93 },
  "gilbert-mouth":      { name: "Gilbert River Mouth",            refPort: "karumba", offsetMinutes: +25, hwFactor: 0.93, lwFactor: 0.88 },
  "mitchell-mouth":     { name: "Mitchell River Mouth ★",         refPort: "karumba", offsetMinutes: -45, hwFactor: 1.05, lwFactor: 1.02 },
  "albert-river":       { name: "Albert River (Burketown)",       refPort: "karumba", offsetMinutes: -90, hwFactor: 0.95, lwFactor: 0.88 },
  "burketown":          { name: "Burketown Ramp",                 refPort: "karumba", offsetMinutes: -85, hwFactor: 0.94, lwFactor: 0.87 },
  "karumba-bay":        { name: "Karumba Bay Open Water",         refPort: "karumba", offsetMinutes:  -5, hwFactor: 1.01, lwFactor: 1.00 },
  "pormpuraaw":         { name: "Pormpuraaw Ramp",                refPort: "karumba", offsetMinutes: -30, hwFactor: 1.03, lwFactor: 1.01 },
  "edward-river":       { name: "Edward River (Pormpuraaw)",      refPort: "karumba", offsetMinutes: -35, hwFactor: 1.02, lwFactor: 1.00 },

  // ── Western Cape York (reference: weipa) ──────────────────────────────────
  "weipa-causeway":     { name: "Weipa Causeway GT Spot ★",       refPort: "weipa",   offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "embley-river":       { name: "Embley River Upper (Weipa)",     refPort: "weipa",   offsetMinutes: +30, hwFactor: 0.90, lwFactor: 0.82 },
  "evans-landing":      { name: "Evans Landing",                   refPort: "weipa",   offsetMinutes: +10, hwFactor: 0.97, lwFactor: 0.94 },
  "ducie-river":        { name: "Ducie River Mouth",               refPort: "weipa",   offsetMinutes: +15, hwFactor: 0.96, lwFactor: 0.92 },
  "archer-river":       { name: "Archer River Mouth",              refPort: "weipa",   offsetMinutes: +60, hwFactor: 0.88, lwFactor: 0.80 },
  "wenlock-river":      { name: "Wenlock River Mouth",             refPort: "weipa",   offsetMinutes: -30, hwFactor: 1.04, lwFactor: 1.00 },

  // ── Far North QLD (reference: cairns) ─────────────────────────────────────
  "trinity-bay":        { name: "Trinity Bay Boat Ramp",           refPort: "cairns",  offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "barron-delta":       { name: "Barron River Delta (Cairns)",     refPort: "cairns",  offsetMinutes: +10, hwFactor: 0.97, lwFactor: 0.94 },
  "port-douglas":       { name: "Port Douglas Marina",             refPort: "cairns",  offsetMinutes: -20, hwFactor: 1.02, lwFactor: 1.00 },
  "marlin-marina":      { name: "Cairns Marlin Marina",            refPort: "cairns",  offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "agincourt-reef":     { name: "Agincourt Reef (outer GBR)",      refPort: "cairns",  offsetMinutes: -35, hwFactor: 0.85, lwFactor: 0.80 },

  // ── Cooktown / FNQ Coast (reference: cooktown) ────────────────────────────
  "endeavour-river":    { name: "Endeavour River (Cooktown) ★",   refPort: "cooktown", offsetMinutes:  +5, hwFactor: 0.98, lwFactor: 0.96 },
  "cooktown-marina":    { name: "Cooktown Marina Ramp",            refPort: "cooktown", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "princess-charlotte": { name: "Princess Charlotte Bay",          refPort: "cooktown", offsetMinutes: -45, hwFactor: 1.05, lwFactor: 1.03 },
  "laura-river":        { name: "Laura River Mouth",               refPort: "cooktown", offsetMinutes: -30, hwFactor: 1.02, lwFactor: 0.98 },
};

// Merge NQ locations into NT_LOCATIONS for uniform lookup
Object.assign(NT_LOCATIONS, NQ_LOCATIONS);


// ─── Helpers ───────────────────────────────────────────────────────────────────
// UTC offset hours by refPort (Darwin = 9.5, Brisbane = 10, Groote/Gove = 9.5)
const PORT_UTC_OFFSET: Record<string, number> = {
  darwin: 9.5, gove: 9.5, groote: 9.5,
  karumba: 10, weipa: 10, cairns: 10, cooktown: 10,
};

// Format a UTC timestamp as local time for the given UTC offset
function formatLocalTime(timestamp: number, utcOffsetHours: number = 9.5): string {
  const offsetMs = utcOffsetHours * 60 * 60 * 1000;
  const local = new Date(timestamp + offsetMs);
  let h = local.getUTCHours();
  const min = local.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min.toString().padStart(2, "0")} ${ampm}`;
}

// Legacy alias kept for any remaining references
function formatDarwinTime(timestamp: number): string {
  return formatLocalTime(timestamp, 9.5);
}

// Get local date string "YYYY-MM-DD" for a UTC timestamp
function getLocalDate(timestamp: number, utcOffsetHours: number = 9.5): string {
  const offsetMs = utcOffsetHours * 60 * 60 * 1000;
  const local = new Date(timestamp + offsetMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Legacy alias
function getDarwinDate(timestamp: number): string {
  return getLocalDate(timestamp, 9.5);
}

// Apply secondary port corrections — timezone-aware
function applyCorrection(
  tides: TideDay[],
  offsetMinutes: number,
  hwFactor: number,
  lwFactor: number,
  utcOffsetHours: number = 9.5
): TideDay[] {
  const offsetMs = offsetMinutes * 60 * 1000;

  // Flatten, shift time, scale height
  const all: TideEntry[] = tides.flatMap((d) =>
    d.tides.map((t) => ({
      timestamp: t.timestamp + offsetMs,
      time: formatLocalTime(t.timestamp + offsetMs, utcOffsetHours),
      type: t.type,
      height: parseFloat(
        (t.height * (t.type === "HW" ? hwFactor : lwFactor)).toFixed(2)
      ),
    }))
  );

  // Regroup by local date
  const grouped = new Map<string, TideDay>();
  for (const t of all) {
    const date = getLocalDate(t.timestamp, utcOffsetHours);
    if (!grouped.has(date)) grouped.set(date, { date, tides: [] });
    grouped.get(date)!.tides.push(t);
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

// ─── BOM HTML parser (unchanged) ──────────────────────────────────────────────
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

  // Determine region and timezone from port code prefix
  const isQLD = portCode.startsWith("QLD_");
  const region = isQLD ? "QLD" : "NT";
  const tz = isQLD ? "Australia/Brisbane" : "Australia/Darwin";

  const localDate = new Date().toLocaleDateString("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  const url = new URL("https://www.bom.gov.au/australia/tides/print.php");
  url.searchParams.set("aac", portCode);
  url.searchParams.set("type", "tide");
  url.searchParams.set("date", localDate);
  url.searchParams.set("region", region);
  url.searchParams.set("tz", tz);
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

// GET /api/tides?port=darwin&days=3   (legacy — primary BOM ports)
// GET /api/tides?location=shady-camp&days=3  (new — secondary with corrections)
router.get("/tides", async (req, res) => {
  const days = Math.min(parseInt((req.query["days"] as string) || "3", 10), 5);
  const locationId = req.query["location"] as string | undefined;
  const portKey = ((req.query["port"] as string) || "darwin").toLowerCase();

  try {
    // ── Secondary location (with correction) ──────────────────────────────────
    if (locationId) {
      const loc = NT_LOCATIONS[locationId];
      if (!loc) {
        res.status(400).json({ error: `Unknown location: ${locationId}` });
        return;
      }
      const port = BOM_PORTS[loc.refPort];
      const utcOffset = PORT_UTC_OFFSET[loc.refPort] ?? 9.5;
      const rawTides = await fetchBomTides(port.code, days + 1); // fetch extra day to cover offset
      const corrected = applyCorrection(rawTides, loc.offsetMinutes, loc.hwFactor, loc.lwFactor, utcOffset);
      // Return only the requested number of days starting from today (local)
      const today = getLocalDate(Date.now(), utcOffset);
      const filtered = corrected.filter((d) => d.date >= today).slice(0, days);
      res.json({ port: loc.name, portKey: locationId, data: filtered, isSecondary: true, refPort: loc.refPort });
      return;
    }

    // ── Primary BOM port ──────────────────────────────────────────────────────
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

// GET /api/tides/locations  — returns all NT locations grouped by region
router.get("/tides/locations", (_req, res) => {
  res.json(
    Object.entries(NT_LOCATIONS).map(([id, loc]) => ({
      id,
      name: loc.name,
      refPort: loc.refPort,
      offsetMinutes: loc.offsetMinutes,
    }))
  );
});

export default router;
