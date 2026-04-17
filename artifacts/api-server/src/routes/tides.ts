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

// ─── Timezone offset constants (milliseconds) ──────────────────────────────────
const TZ_WA  = 8 * 3600 * 1000;         // UTC+8  (AWST)
const TZ_NT  = 9.5 * 3600 * 1000;       // UTC+9:30 (ACST)
const TZ_QLD = 10 * 3600 * 1000;        // UTC+10 (AEST/no DST)

// ─── Primary BOM port definitions ─────────────────────────────────────────────
interface PortDef {
  code: string;
  name: string;
  tzOffsetMs: number;
  bomRegion: string;
  bomTz: string;
}

const BOM_PORTS: Record<string, PortDef> = {
  // ── WA ports ─────────────────────────────────────────────────────────────────
  broome:           { code: "WA_TP001", name: "Broome",                 tzOffsetMs: TZ_WA,  bomRegion: "WA",  bomTz: "Australia/Perth"    },
  derby:            { code: "WA_TP002", name: "Derby (King Sound)",     tzOffsetMs: TZ_WA,  bomRegion: "WA",  bomTz: "Australia/Perth"    },
  "port-hedland":   { code: "WA_TP003", name: "Port Hedland",           tzOffsetMs: TZ_WA,  bomRegion: "WA",  bomTz: "Australia/Perth"    },
  exmouth:          { code: "WA_TP004", name: "Exmouth (Learmonth)",    tzOffsetMs: TZ_WA,  bomRegion: "WA",  bomTz: "Australia/Perth"    },
  carnarvon:        { code: "WA_TP005", name: "Carnarvon",              tzOffsetMs: TZ_WA,  bomRegion: "WA",  bomTz: "Australia/Perth"    },
  dampier:          { code: "WA_TP006", name: "Dampier",                tzOffsetMs: TZ_WA,  bomRegion: "WA",  bomTz: "Australia/Perth"    },
  wyndham:          { code: "WA_TP007", name: "Wyndham (Cambridge Gulf)",tzOffsetMs: TZ_WA,  bomRegion: "WA",  bomTz: "Australia/Perth"    },
  // ── NT ports ─────────────────────────────────────────────────────────────────
  darwin:           { code: "NT_TP001", name: "Darwin",                 tzOffsetMs: TZ_NT,  bomRegion: "NT",  bomTz: "Australia/Darwin"   },
  nhulunbuy:        { code: "NT_TP002", name: "Nhulunbuy (Gove)",       tzOffsetMs: TZ_NT,  bomRegion: "NT",  bomTz: "Australia/Darwin"   },
  // ── QLD / NQ ports ───────────────────────────────────────────────────────────
  karumba:          { code: "QLD_TP001", name: "Karumba",               tzOffsetMs: TZ_QLD, bomRegion: "QLD", bomTz: "Australia/Brisbane" },
  weipa:            { code: "QLD_TP002", name: "Weipa",                 tzOffsetMs: TZ_QLD, bomRegion: "QLD", bomTz: "Australia/Brisbane" },
  cairns:           { code: "QLD_TP003", name: "Cairns",                tzOffsetMs: TZ_QLD, bomRegion: "QLD", bomTz: "Australia/Brisbane" },
};

// ─── Secondary location definitions ───────────────────────────────────────────
interface LocationCfg {
  name: string;
  refPort: string;
  offsetMinutes: number;
  hwFactor: number;
  lwFactor: number;
}

// ── WA secondary locations ─────────────────────────────────────────────────────
const WA_LOCATIONS: Record<string, LocationCfg> = {
  "broome-town-beach":     { name: "Broome Town Beach Ramp",            refPort: "broome",       offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "roebuck-bay":           { name: "Roebuck Bay",                       refPort: "broome",       offsetMinutes:  +5, hwFactor: 0.98, lwFactor: 0.97 },
  "cable-beach-ramp":      { name: "Cable Beach Ramp",                  refPort: "broome",       offsetMinutes:  -5, hwFactor: 0.97, lwFactor: 0.96 },
  "dampier-creek":         { name: "Dampier Creek Mangroves",           refPort: "broome",       offsetMinutes: +15, hwFactor: 0.93, lwFactor: 0.90 },
  "gantheaume-point":      { name: "Gantheaume Point",                  refPort: "broome",       offsetMinutes:  -8, hwFactor: 0.96, lwFactor: 0.95 },
  "derby-jetty":           { name: "Derby Jetty Ramp",                  refPort: "derby",        offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "king-sound-mouth":      { name: "King Sound Mouth",                  refPort: "derby",        offsetMinutes: -30, hwFactor: 0.92, lwFactor: 0.88 },
  "fitzroy-mouth":         { name: "Fitzroy River Mouth",               refPort: "derby",        offsetMinutes: +25, hwFactor: 0.88, lwFactor: 0.82 },
  "fitzroy-crossing-ramp": { name: "Fitzroy Crossing Ramp",             refPort: "derby",        offsetMinutes: +180, hwFactor: 0.62, lwFactor: 0.52 },
  "willare-ramp":          { name: "Willare Ramp",                      refPort: "derby",        offsetMinutes: +90, hwFactor: 0.75, lwFactor: 0.68 },
  "ord-mouth":             { name: "Ord River Mouth (Cambridge Gulf)",   refPort: "wyndham",     offsetMinutes:  +5, hwFactor: 0.97, lwFactor: 0.95 },
  "wyndham-ramp":          { name: "Wyndham Boat Ramp",                 refPort: "wyndham",      offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "lake-kununurra":        { name: "Lake Kununurra (Ord Stage 1)",      refPort: "wyndham",      offsetMinutes: +480, hwFactor: 0.35, lwFactor: 0.25 },
  "ord-middle-reaches":    { name: "Ord River Middle Reaches",          refPort: "wyndham",      offsetMinutes: +240, hwFactor: 0.55, lwFactor: 0.45 },
  "keep-river":            { name: "Keep River Mouth",                  refPort: "wyndham",      offsetMinutes: +30, hwFactor: 0.90, lwFactor: 0.85 },
  "drysdale-mouth":        { name: "Drysdale River Mouth",              refPort: "wyndham",      offsetMinutes: -30, hwFactor: 0.93, lwFactor: 0.88 },
  "mitchell-river":        { name: "Mitchell River Mouth",              refPort: "wyndham",      offsetMinutes: -45, hwFactor: 0.90, lwFactor: 0.85 },
  "prince-regent":         { name: "Prince Regent River",              refPort: "derby",         offsetMinutes: +60, hwFactor: 0.87, lwFactor: 0.80 },
  "berkeley-sound":        { name: "Berkeley Sound (Vansittart Bay)",   refPort: "wyndham",      offsetMinutes: -90, hwFactor: 0.85, lwFactor: 0.78 },
  "king-george-falls":     { name: "King George Falls Area",            refPort: "wyndham",      offsetMinutes: -60, hwFactor: 0.88, lwFactor: 0.82 },
  "port-hedland-ramp":     { name: "Port Hedland Boat Ramp",            refPort: "port-hedland", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "de-grey-mouth":         { name: "De Grey River Mouth",              refPort: "port-hedland",  offsetMinutes: -20, hwFactor: 0.95, lwFactor: 0.92 },
  "pardoo-station":        { name: "Pardoo Roadhouse Area",             refPort: "port-hedland", offsetMinutes: -35, hwFactor: 0.92, lwFactor: 0.88 },
  "montebello-islands":    { name: "Montebello Islands",               refPort: "dampier",       offsetMinutes: -25, hwFactor: 0.90, lwFactor: 0.88 },
  "exmouth-ramp":          { name: "Exmouth Boat Ramp",                refPort: "exmouth",       offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "exmouth-gulf":          { name: "Exmouth Gulf Flats",               refPort: "exmouth",       offsetMinutes: +20, hwFactor: 0.95, lwFactor: 0.92 },
  "ningaloo-reef":         { name: "Ningaloo Reef (Outside)",          refPort: "exmouth",       offsetMinutes: -15, hwFactor: 0.92, lwFactor: 0.90 },
  "coral-bay":             { name: "Coral Bay Ramp",                   refPort: "carnarvon",     offsetMinutes: -30, hwFactor: 0.88, lwFactor: 0.85 },
  "turquoise-bay":         { name: "Turquoise Bay Area",               refPort: "exmouth",       offsetMinutes: -10, hwFactor: 0.93, lwFactor: 0.90 },
  "dampier-ramp":          { name: "Dampier Boat Ramp",                refPort: "dampier",       offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "burrup-peninsula":      { name: "Burrup Peninsula",                 refPort: "dampier",       offsetMinutes: +10, hwFactor: 0.97, lwFactor: 0.95 },
  "legendre-island":       { name: "Legendre Island",                  refPort: "dampier",       offsetMinutes: -20, hwFactor: 0.92, lwFactor: 0.90 },
  "mermaid-sound":         { name: "Mermaid Sound",                    refPort: "dampier",       offsetMinutes: +15, hwFactor: 0.96, lwFactor: 0.94 },
  "roebourne-ramp":        { name: "Roebourne / Point Samson Ramp",    refPort: "dampier",       offsetMinutes: -30, hwFactor: 0.90, lwFactor: 0.88 },
  "carnarvon-ramp":        { name: "Carnarvon Boat Ramp",              refPort: "carnarvon",     offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "gascoyne-mouth":        { name: "Gascoyne River Mouth",             refPort: "carnarvon",     offsetMinutes: +10, hwFactor: 0.97, lwFactor: 0.94 },
  "shark-bay":             { name: "Monkey Mia / Shark Bay",           refPort: "carnarvon",     offsetMinutes: -45, hwFactor: 0.82, lwFactor: 0.78 },
};

// ── NT secondary locations (all corrected from Darwin) ─────────────────────────
const NT_LOCATIONS: Record<string, LocationCfg> = {
  "darwin-city":      { name: "Darwin City Ramp",                refPort: "darwin", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "fannie-bay":       { name: "Fannie Bay Ramp",                 refPort: "darwin", offsetMinutes:  -5, hwFactor: 0.99, lwFactor: 0.99 },
  "cullen-bay":       { name: "Cullen Bay Marina",               refPort: "darwin", offsetMinutes:  +5, hwFactor: 0.97, lwFactor: 0.97 },
  "nightcliff":       { name: "Nightcliff Ramp",                 refPort: "darwin", offsetMinutes:  -8, hwFactor: 0.98, lwFactor: 0.98 },
  "lee-point":        { name: "Lee Point Beach",                 refPort: "darwin", offsetMinutes: -10, hwFactor: 0.97, lwFactor: 0.97 },
  "mandorah":         { name: "Mandorah Ramp",                   refPort: "darwin", offsetMinutes: -10, hwFactor: 0.99, lwFactor: 0.99 },
  "cox-peninsula":    { name: "Cox Peninsula Ramp",              refPort: "darwin", offsetMinutes: +15, hwFactor: 0.96, lwFactor: 0.96 },
  "bynoe-harbour":    { name: "Bynoe Harbour",                   refPort: "darwin", offsetMinutes: +20, hwFactor: 0.95, lwFactor: 0.95 },
  "gunn-point":       { name: "Gunn Point Beach",                refPort: "darwin", offsetMinutes: -15, hwFactor: 0.97, lwFactor: 0.97 },
  "east-arm":         { name: "East Arm Wharf Area",             refPort: "darwin", offsetMinutes:  +5, hwFactor: 0.98, lwFactor: 0.98 },
  "adelaide-mouth":   { name: "Adelaide River Mouth",            refPort: "darwin", offsetMinutes:  +5, hwFactor: 0.96, lwFactor: 0.94 },
  "point-stuart":     { name: "Point Stuart Ramp",               refPort: "darwin", offsetMinutes: +20, hwFactor: 0.94, lwFactor: 0.92 },
  "window-wetlands":  { name: "Window on the Wetlands",          refPort: "darwin", offsetMinutes: +30, hwFactor: 0.90, lwFactor: 0.85 },
  "annaburroo":       { name: "Annaburroo Ramp",                 refPort: "darwin", offsetMinutes: +40, hwFactor: 0.88, lwFactor: 0.82 },
  "mary-mouth":       { name: "Mary River Mouth (Pt Ragged)",    refPort: "darwin", offsetMinutes: +10, hwFactor: 0.97, lwFactor: 0.95 },
  "shady-camp":       { name: "Shady Camp Rock Bar",             refPort: "darwin", offsetMinutes: +15, hwFactor: 0.96, lwFactor: 0.94 },
  "shady-camp-ramp":  { name: "Shady Camp Boat Ramp",            refPort: "darwin", offsetMinutes: +15, hwFactor: 0.96, lwFactor: 0.94 },
  "corroboree":       { name: "Corroboree (Mary R.)",            refPort: "darwin", offsetMinutes: +40, hwFactor: 0.88, lwFactor: 0.82 },
  "marrakai":         { name: "Marrakai Ramp",                   refPort: "darwin", offsetMinutes: +45, hwFactor: 0.87, lwFactor: 0.80 },
  "daly-mouth":       { name: "Daly River Mouth",                refPort: "darwin", offsetMinutes: +45, hwFactor: 0.90, lwFactor: 0.88 },
  "snake-creek":      { name: "Snake Creek Ramp",                refPort: "darwin", offsetMinutes: +65, hwFactor: 0.85, lwFactor: 0.82 },
  "woolianna":        { name: "Woolianna Ramp",                  refPort: "darwin", offsetMinutes: +90, hwFactor: 0.80, lwFactor: 0.75 },
  "daly-river-town":  { name: "Daly River Town Ramp",            refPort: "darwin", offsetMinutes: +120, hwFactor: 0.75, lwFactor: 0.70 },
  "port-keats":       { name: "Wadeye (Port Keats)",             refPort: "darwin", offsetMinutes: +180, hwFactor: 0.70, lwFactor: 0.65 },
  "south-alligator":  { name: "South Alligator Mouth",           refPort: "darwin", offsetMinutes: +10, hwFactor: 0.96, lwFactor: 0.94 },
  "field-island":     { name: "Field Island",                    refPort: "darwin", offsetMinutes:  +5, hwFactor: 0.97, lwFactor: 0.97 },
  "cahills-crossing": { name: "Cahills Crossing Rock Bar",       refPort: "darwin", offsetMinutes: +30, hwFactor: 0.90, lwFactor: 0.87 },
  "east-alligator":   { name: "East Alligator River Mouth",      refPort: "darwin", offsetMinutes: +25, hwFactor: 0.92, lwFactor: 0.90 },
  "west-alligator":   { name: "West Alligator River Mouth",      refPort: "darwin", offsetMinutes:  +5, hwFactor: 0.97, lwFactor: 0.97 },
  "port-essington":   { name: "Port Essington",                  refPort: "darwin", offsetMinutes: +30, hwFactor: 0.90, lwFactor: 0.88 },
  "cobourg":          { name: "Cobourg Peninsula",               refPort: "darwin", offsetMinutes: +25, hwFactor: 0.91, lwFactor: 0.90 },
  "smith-point":      { name: "Smith Point (Cobourg)",           refPort: "darwin", offsetMinutes: +20, hwFactor: 0.92, lwFactor: 0.91 },
  "victoria-mouth":   { name: "Victoria River Mouth",            refPort: "darwin", offsetMinutes: +160, hwFactor: 0.82, lwFactor: 0.78 },
  "big-horse-creek":  { name: "Big Horse Creek Ramp",            refPort: "darwin", offsetMinutes: +180, hwFactor: 0.78, lwFactor: 0.72 },
  "baines-river":     { name: "Baines River Mouth",              refPort: "darwin", offsetMinutes: +155, hwFactor: 0.83, lwFactor: 0.78 },
  "nhulunbuy-ramp":   { name: "Nhulunbuy (Gove) Ramp",           refPort: "nhulunbuy", offsetMinutes: 0, hwFactor: 1.00, lwFactor: 1.00 },
  "melville-bay":     { name: "Melville Bay (Gove)",             refPort: "nhulunbuy", offsetMinutes: 0, hwFactor: 0.97, lwFactor: 0.97 },
  "caledon-bay":      { name: "Caledon Bay",                     refPort: "nhulunbuy", offsetMinutes: +30, hwFactor: 0.92, lwFactor: 0.90 },
  "trial-bay":        { name: "Trial Bay (Arnhem Land)",         refPort: "nhulunbuy", offsetMinutes: +20, hwFactor: 0.94, lwFactor: 0.92 },
  "buckingham-bay":   { name: "Buckingham Bay",                  refPort: "nhulunbuy", offsetMinutes: +45, hwFactor: 0.90, lwFactor: 0.88 },
  "roper-bar":        { name: "Roper Bar",                       refPort: "nhulunbuy", offsetMinutes: -120, hwFactor: 0.75, lwFactor: 0.68 },
  "borroloola":       { name: "Borroloola / McArthur River",     refPort: "nhulunbuy", offsetMinutes: -60, hwFactor: 0.85, lwFactor: 0.80 },
  "bing-bong":        { name: "Bing Bong Ramp",                  refPort: "nhulunbuy", offsetMinutes: -90, hwFactor: 0.80, lwFactor: 0.75 },
  "pellew-islands":   { name: "Sir Edward Pellew Islands",       refPort: "nhulunbuy", offsetMinutes: -100, hwFactor: 0.78, lwFactor: 0.72 },
};

// ── NQ secondary locations (corrected from Karumba, Weipa, or Cairns) ──────────
const NQ_LOCATIONS: Record<string, LocationCfg> = {
  "karumba-point":    { name: "Karumba Point Ramp",              refPort: "karumba", offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "normanton":        { name: "Normanton Wharf Deep Hole",       refPort: "karumba", offsetMinutes: +30, hwFactor: 0.88, lwFactor: 0.82 },
  "flinders-mouth":   { name: "Flinders River Mouth",            refPort: "karumba", offsetMinutes: +30, hwFactor: 0.90, lwFactor: 0.85 },
  "gilbert-mouth":    { name: "Gilbert River Mouth",             refPort: "karumba", offsetMinutes: +20, hwFactor: 0.92, lwFactor: 0.88 },
  "albert-river":     { name: "Burketown / Albert River",        refPort: "karumba", offsetMinutes: +60, hwFactor: 0.85, lwFactor: 0.78 },
  "weipa-causeway":   { name: "Weipa Causeway",                  refPort: "weipa",   offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "evans-landing":    { name: "Evans Landing Ramp (Weipa)",      refPort: "weipa",   offsetMinutes:  +5, hwFactor: 0.99, lwFactor: 0.99 },
  "pormpuraaw":       { name: "Pormpuraaw / Edward River",       refPort: "weipa",   offsetMinutes: +60, hwFactor: 0.88, lwFactor: 0.83 },
  "marlin-marina":    { name: "Cairns Marlin Marina",            refPort: "cairns",  offsetMinutes:   0, hwFactor: 1.00, lwFactor: 1.00 },
  "port-douglas":     { name: "Port Douglas Marina",             refPort: "cairns",  offsetMinutes: -15, hwFactor: 0.97, lwFactor: 0.96 },
  "cooktown-marina":  { name: "Cooktown / Endeavour River",      refPort: "cairns",  offsetMinutes: -45, hwFactor: 0.92, lwFactor: 0.88 },
};

// ─── Unified location lookup ───────────────────────────────────────────────────
const ALL_LOCATIONS: Record<string, LocationCfg> = {
  ...WA_LOCATIONS,
  ...NT_LOCATIONS,
  ...NQ_LOCATIONS,
};

// ─── Time formatting helpers (timezone-aware) ──────────────────────────────────
function formatLocalTime(timestamp: number, tzOffsetMs: number): string {
  const local = new Date(timestamp + tzOffsetMs);
  let h = local.getUTCHours();
  const min = local.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min.toString().padStart(2, "0")} ${ampm}`;
}

function getLocalDate(timestamp: number, tzOffsetMs: number): string {
  const local = new Date(timestamp + tzOffsetMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── Apply secondary port corrections ─────────────────────────────────────────
function applyCorrection(
  tides: TideDay[],
  offsetMinutes: number,
  hwFactor: number,
  lwFactor: number,
  tzOffsetMs: number,
): TideDay[] {
  const offsetMs = offsetMinutes * 60 * 1000;

  const all: TideEntry[] = tides.flatMap((d) =>
    d.tides.map((t) => ({
      timestamp: t.timestamp + offsetMs,
      time: formatLocalTime(t.timestamp + offsetMs, tzOffsetMs),
      type: t.type,
      height: parseFloat(
        (t.height * (t.type === "HW" ? hwFactor : lwFactor)).toFixed(2)
      ),
    }))
  );

  const grouped = new Map<string, TideDay>();
  for (const t of all) {
    const date = getLocalDate(t.timestamp, tzOffsetMs);
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

async function fetchBomTides(port: PortDef, days: number): Promise<TideDay[]> {
  const cacheKey = `${port.code}-${days}`;
  const now = Date.now();
  if (cache[cacheKey] && now - cache[cacheKey].fetchedAt < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  const localDate = new Date().toLocaleDateString("en-CA", {
    timeZone: port.bomTz,
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  const url = new URL("https://www.bom.gov.au/australia/tides/print.php");
  url.searchParams.set("aac", port.code);
  url.searchParams.set("type", "tide");
  url.searchParams.set("date", localDate);
  url.searchParams.set("region", port.bomRegion);
  url.searchParams.set("tz", port.bomTz);
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

router.get("/tides", async (req, res) => {
  const days = Math.min(parseInt((req.query["days"] as string) || "3", 10), 5);
  const locationId = req.query["location"] as string | undefined;
  const portKey = ((req.query["port"] as string) || "broome").toLowerCase();

  try {
    if (locationId) {
      const loc = ALL_LOCATIONS[locationId];
      if (!loc) {
        res.status(400).json({ error: `Unknown location: ${locationId}` });
        return;
      }
      const port = BOM_PORTS[loc.refPort];
      if (!port) {
        res.status(400).json({ error: `Unknown reference port: ${loc.refPort}` });
        return;
      }
      const rawTides = await fetchBomTides(port, days + 1);
      const corrected = applyCorrection(rawTides, loc.offsetMinutes, loc.hwFactor, loc.lwFactor, port.tzOffsetMs);
      const today = getLocalDate(Date.now(), port.tzOffsetMs);
      const filtered = corrected.filter((d) => d.date >= today).slice(0, days);
      res.json({ port: loc.name, portKey: locationId, data: filtered, isSecondary: true, refPort: loc.refPort });
      return;
    }

    const port = BOM_PORTS[portKey];
    if (!port) {
      res.status(400).json({ error: `Unknown port. Use ?location=ID or ?port=${Object.keys(BOM_PORTS).join("|")}` });
      return;
    }
    const data = await fetchBomTides(port, days);
    res.json({ port: port.name, portKey, data, isSecondary: false });

  } catch (err) {
    req.log.error({ err }, "BOM tides fetch failed");
    res.status(502).json({
      error: err instanceof Error ? err.message : "Could not fetch tide data from Bureau of Meteorology.",
    });
  }
});

router.get("/tides/locations", (_req, res) => {
  res.json({
    wa: Object.entries(WA_LOCATIONS).map(([id, loc]) => ({ id, name: loc.name, refPort: loc.refPort, offsetMinutes: loc.offsetMinutes })),
    nt: Object.entries(NT_LOCATIONS).map(([id, loc]) => ({ id, name: loc.name, refPort: loc.refPort, offsetMinutes: loc.offsetMinutes })),
    nq: Object.entries(NQ_LOCATIONS).map(([id, loc]) => ({ id, name: loc.name, refPort: loc.refPort, offsetMinutes: loc.offsetMinutes })),
  });
});

export default router;
