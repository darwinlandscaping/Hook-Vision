/**
 * Daily Briefing Engine
 *
 * Runs once on startup, then refreshes daily at midnight WA time (AWST = UTC+8:00).
 * Computes moon phase, WA season, BOM Broome weather, sonar tip of the day,
 * and generates an AI fishing briefing that gets injected into every sonar analysis.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";
import { getModel } from "./models.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WAWeather {
  tempC: number;
  apparentTempC: number;
  humidity: number;
  windDir: string;
  windSpeedKmh: number;
  pressureHpa: number;
  pressureTrend: string;
  conditions: string;
}

export interface MoonData {
  phase: number;        // 0–1 (0 = new, 0.5 = full)
  name: string;
  emoji: string;
  illuminationPct: number;
  fishingRating: string;
}

export interface WASeasonData {
  name: string;
  emoji: string;
  fishingContext: string;
  waterTempRange: string;
  topTechnique: string;
}

export interface DailyConditions {
  date: string;
  waLocalTime: string;
  season: WASeasonData;
  moon: MoonData;
  weather: WAWeather | null;
  barraActivity: string;
  sonarTip: string;
  aiBriefing: string;
  lastRefreshed: string;
  nextRefresh: string;
  refreshCount: number;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _cache: DailyConditions | null = null;
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;
let _refreshCount = 0;

// Short-TTL weather cache: BOM updates every ~30min, we refresh every 20min
const WEATHER_TTL_MS = 20 * 60 * 1000;
let _weatherCache: { data: WAWeather | null; fetchedAt: number } | null = null;

/** Returns fresh BOM weather — fetches at most once per 20 minutes. */
export async function getLiveWeather(): Promise<WAWeather | null> {
  const now = Date.now();
  if (_weatherCache && now - _weatherCache.fetchedAt < WEATHER_TTL_MS) {
    return _weatherCache.data;
  }
  const data = await fetchWAWeather();
  _weatherCache = { data, fetchedAt: now };
  return data;
}

/** Compute moon phase for right now (WA/Perth time). Free — pure math. */
export function computeMoonNow(): MoonData {
  const waOffsetMs = 8 * 60 * 60 * 1000;
  return computeMoon(new Date(Date.now() + waOffsetMs));
}

// ─── NT (Darwin Airport) weather ──────────────────────────────────────────────

async function fetchNTWeather(): Promise<WAWeather | null> {
  try {
    const res = await fetch(
      "http://www.bom.gov.au/fwo/IDD60801/IDD60801.014015.json",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const obs = data?.observations?.data?.[0];
    if (!obs) return null;
    return {
      tempC:         obs.air_temp          ?? 33,
      apparentTempC: obs.apparent_t        ?? obs.air_temp ?? 33,
      humidity:      obs.rel_hum           ?? 65,
      windDir:       obs.wind_dir          ?? "N/A",
      windSpeedKmh:  obs.wind_spd_kmh      ?? 0,
      pressureHpa:   obs.press             ?? 1008,
      pressureTrend: obs.press_tend        ?? "steady",
      conditions:    obs.weather           ?? "Mostly Sunny",
    };
  } catch (err) {
    logger.warn({ err }, "BOM Darwin weather fetch failed — using defaults");
    return null;
  }
}

let _weatherCacheNT: { data: WAWeather | null; fetchedAt: number } | null = null;

export async function getLiveWeatherNT(): Promise<WAWeather | null> {
  const now = Date.now();
  if (_weatherCacheNT && now - _weatherCacheNT.fetchedAt < WEATHER_TTL_MS) {
    return _weatherCacheNT.data;
  }
  const data = await fetchNTWeather();
  _weatherCacheNT = { data, fetchedAt: now };
  return data;
}

// ─── NQ (Karumba) weather ─────────────────────────────────────────────────────

async function fetchNQWeather(): Promise<WAWeather | null> {
  try {
    const res = await fetch(
      "http://www.bom.gov.au/fwo/IDQ60801/IDQ60801.029004.json",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const obs = data?.observations?.data?.[0];
    if (!obs) return null;
    return {
      tempC:         obs.air_temp          ?? 32,
      apparentTempC: obs.apparent_t        ?? obs.air_temp ?? 32,
      humidity:      obs.rel_hum           ?? 60,
      windDir:       obs.wind_dir          ?? "N/A",
      windSpeedKmh:  obs.wind_spd_kmh      ?? 0,
      pressureHpa:   obs.press             ?? 1009,
      pressureTrend: obs.press_tend        ?? "steady",
      conditions:    obs.weather           ?? "Mostly Sunny",
    };
  } catch (err) {
    logger.warn({ err }, "BOM Karumba weather fetch failed — using defaults");
    return null;
  }
}

let _weatherCacheNQ: { data: WAWeather | null; fetchedAt: number } | null = null;

export async function getLiveWeatherNQ(): Promise<WAWeather | null> {
  const now = Date.now();
  if (_weatherCacheNQ && now - _weatherCacheNQ.fetchedAt < WEATHER_TTL_MS) {
    return _weatherCacheNQ.data;
  }
  const data = await fetchNQWeather();
  _weatherCacheNQ = { data, fetchedAt: now };
  return data;
}

export function getDailyConditions(): DailyConditions | null {
  return _cache;
}

/** Short string injected into the analyze AI prompt */
export function getConditionsContext(): string {
  if (!_cache) return "";
  const w = _cache.weather;
  const lines = [
    `=== TODAY'S WA/KIMBERLEY CONDITIONS (${_cache.date}) ===`,
    `Season: ${_cache.season.emoji} ${_cache.season.name} — ${_cache.season.fishingContext}`,
    `Moon: ${_cache.moon.emoji} ${_cache.moon.name} (${_cache.moon.illuminationPct}% illuminated) — ${_cache.moon.fishingRating}`,
    w ? `Broome Weather: ${w.tempC}°C, ${w.conditions}, Wind ${w.windDir} ${w.windSpeedKmh}km/h, Pressure ${w.pressureHpa}hPa (${w.pressureTrend})` : "",
    `Water temp estimate: ${_cache.season.waterTempRange}`,
    `Barra activity level: ${_cache.barraActivity}`,
    `Sonar tip today: ${_cache.sonarTip}`,
    `AI daily briefing: ${_cache.aiBriefing}`,
    `=== END TODAY'S CONDITIONS ===`,
  ].filter(Boolean);
  return lines.join("\n");
}

// ─── Moon phase ───────────────────────────────────────────────────────────────

function computeMoon(date: Date): MoonData {
  const JD = date.getTime() / 86400000 + 2440587.5;
  let phase = ((JD - 2451550.1) / 29.530588853) % 1;
  if (phase < 0) phase += 1;

  const illuminationPct = Math.round((1 - Math.cos(2 * Math.PI * phase)) / 2 * 100);

  let name: string;
  let emoji: string;
  let fishingRating: string;

  if (phase < 0.025 || phase >= 0.975) {
    name = "New Moon"; emoji = "🌑";
    fishingRating = "Excellent — dark nights, barra feed aggressively at surface. Prime topwater window.";
  } else if (phase < 0.225) {
    name = "Waxing Crescent"; emoji = "🌒";
    fishingRating = "Good — increasing lunar pull, fish becoming more active each day.";
  } else if (phase < 0.275) {
    name = "First Quarter"; emoji = "🌓";
    fishingRating = "Very Good — quarter moon tides are strong and reliable. Evening sessions deadly.";
  } else if (phase < 0.475) {
    name = "Waxing Gibbous"; emoji = "🌔";
    fishingRating = "Good — building to full moon, fish active but can be erratic mid-day.";
  } else if (phase < 0.525) {
    name = "Full Moon"; emoji = "🌕";
    fishingRating = "Peak tides but fish may feed all night — dawn/dusk sessions less reliable. Big fish move at night.";
  } else if (phase < 0.725) {
    name = "Waning Gibbous"; emoji = "🌖";
    fishingRating = "Good — post-full moon tides, fish pattern predictable. Morning sessions best.";
  } else if (phase < 0.775) {
    name = "Last Quarter"; emoji = "🌗";
    fishingRating = "Very Good — quarter moon again. Consistent tidal flow, reliable feeding windows.";
  } else {
    name = "Waning Crescent"; emoji = "🌘";
    fishingRating = "Good — approaching new moon, surface activity building. Pre-dawn sessions excellent.";
  }

  return { phase, name, emoji, illuminationPct, fishingRating };
}

// ─── WA/Kimberley Season ──────────────────────────────────────────────────────

function computeWASeason(date: Date): WASeasonData {
  const month = date.getMonth() + 1;
  if (month >= 10 && month <= 12) {
    return {
      name: "Build-up",
      emoji: "⚡",
      fishingContext: "Storms building, water warming fast. Barra are aggressive pre-wet. Surface lures at dawn/dusk produce. Best fishing of the year approaching.",
      waterTempRange: "29–32°C (warming rapidly)",
      topTechnique: "Surface poppers at first light. Barra are up and hungry before the rains hit.",
    };
  }
  if (month <= 2) {
    return {
      name: "Wet Season",
      emoji: "🌧️",
      fishingContext: "Heavy rain, flooding, fresh water inflows. Barra spread into flooded country. Target creek mouths and freshwater inflows on the receding tide. Big fish moving.",
      waterTempRange: "29–33°C (peak temperatures)",
      topTechnique: "Creek mouth ambush on run-out tide. Fresh/salt water boundary is the strike zone.",
    };
  }
  if (month <= 4) {
    return {
      name: "Run-off",
      emoji: "💧",
      fishingContext: "Water clearing post-wet. Barra stacked at creek exits and channel drops. Prime trophy season — 80cm+ fish common on the run-off. FISH NOW.",
      waterTempRange: "28–32°C (still warm)",
      topTechnique: "Hardbodies and large soft plastics at channel edges. Best time of year for big barra.",
    };
  }
  return {
    name: "Dry Season",
    emoji: "☀️",
    fishingContext: "Clear water, consistent tidal conditions. Fish on known structure — rock bars, snags, pylons. Early morning and dusk are peak windows. Water gradually cooling.",
    waterTempRange: "24–29°C (cooling through the season)",
    topTechnique: "Structure fishing with bibbed minnows. Work lures slow and deep into the snag.",
  };
}

// ─── BOM Broome weather ───────────────────────────────────────────────────────

async function fetchWAWeather(): Promise<WAWeather | null> {
  try {
    // BOM Broome Airport (WA station 003003)
    const res = await fetch(
      "http://www.bom.gov.au/fwo/IDW60801/IDW60801.003003.json",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const obs = data?.observations?.data?.[0];
    if (!obs) return null;

    return {
      tempC:         obs.air_temp          ?? 31,
      apparentTempC: obs.apparent_t        ?? obs.air_temp ?? 31,
      humidity:      obs.rel_hum           ?? 55,
      windDir:       obs.wind_dir          ?? "N/A",
      windSpeedKmh:  obs.wind_spd_kmh      ?? 0,
      pressureHpa:   obs.press             ?? 1010,
      pressureTrend: obs.press_tend        ?? "steady",
      conditions:    obs.weather           ?? "Fair",
    };
  } catch (err) {
    logger.warn({ err }, "BOM Broome weather fetch failed — using defaults");
    return null;
  }
}

// ─── Barra activity rating ────────────────────────────────────────────────────

function computeBarraActivity(moon: MoonData, season: WASeasonData, weather: WAWeather | null): string {
  let score = 50;

  // Moon influence
  if (moon.name === "New Moon" || moon.name === "Full Moon")    score += 25;
  else if (moon.name === "First Quarter" || moon.name === "Last Quarter") score += 20;
  else if (moon.name.includes("Crescent"))                       score += 10;
  else                                                           score += 15;

  // Season influence
  if (season.name === "Run-off")    score += 20;
  else if (season.name === "Build-up") score += 15;
  else if (season.name === "Wet Season") score += 10;
  else                              score += 5; // Dry season

  // Barometric pressure trend
  if (weather) {
    if (weather.pressureTrend === "falling") score += 15; // pressure drop = fish active
    if (weather.pressureHpa < 1005)          score += 10; // low pressure = fish active
    if (weather.pressureTrend === "rising")  score += 5;
    if (weather.windSpeedKmh > 25)           score -= 10; // strong wind = harder
  }

  score = Math.min(99, Math.max(20, score));

  if (score >= 85) return `🔥 EXCEPTIONAL (${score}/100) — Multiple feeding windows. Fish are active and aggressive.`;
  if (score >= 70) return `✅ VERY GOOD (${score}/100) — Strong feeding windows. Worth an early start.`;
  if (score >= 55) return `👍 GOOD (${score}/100) — Standard conditions. Fish on the right tide phase.`;
  if (score >= 40) return `⚠️ MODERATE (${score}/100) — Selective. Focus on structure. Live bait may outperform lures.`;
  return `🌀 TOUGH (${score}/100) — Difficult conditions. Target deep holes and sheltered water. Patience required.`;
}

// ─── Rotating sonar tips (365 tips pool) ─────────────────────────────────────

const SONAR_TIPS = [
  "Arch THICKNESS = fish SIZE. Ignore the arch length completely. A fat short arch = big barra. A long thin arch = small fish.",
  "If the arch touches or merges with the bottom echo = fish is lethargic. A small gap between arch and bottom = fish is feeding. THAT gap is gold.",
  "Double echo on the bottom (second line at exactly double the depth) = you're over bedrock. This is the hardest, most fish-holding substrate in Kimberley river systems.",
  "Barra arches sit ON hard structure. Threadfin arches float MID-COLUMN over soft bottom. This one difference tells you which species you're seeing.",
  "A bait cloud that BALLS UP into a sphere = predators are attacking from below. Large arches at the edge = those are your fish. Cast to the edge of the ball NOW.",
  "In turbid Kimberley estuaries, the swim bladder return cuts through sediment haze. Look for the BRIGHTEST marks in the fuzzy water column — that's barra.",
  "Running tide: arches lift off the bottom = fish active and feeding. Slack tide: arches merge with structure = fish resting. Your sonar is a tide gauge too.",
  "DownScan timber ID: a fallen log shows as a long horizontal bright streak with a clear shadow below. Barra arch sits ON TOP of that streak.",
  "Kimberley croc check every scan: solid FILLED elongated blob in the top 3m, much brighter than any fish, no hollow arch centre = crocodile. DO NOT enter the water.",
  "On rock bars, the barra sits at the UPSTREAM edge of the bar facing into the current. Cast past the bar and retrieve toward them.",
  "High frequency (200kHz+) = sharper, more accurate arches for shallow water under 20m. CHIRP gives the cleanest individual arch separation.",
  "A straight horizontal line instead of an arch = fish was stationary under you for an extended time. Means it's not moving — probably resting or spooked.",
  "Standing flooded timber on sonar looks like a 'city skyline' of vertical columns from the bottom. Barra arches appear at the TOP and BASE of each column.",
  "Mangrove jack arches are EMBEDDED in the structure echo — a bright bump ON or inside the hard-structure return. Never floating free in the water.",
  "Fingermark school as a GROUP 0.5–3m above rocky reef. Multiple clean arches above bumpy bottom = goldies. Singles tight to structure = rock cod.",
  "The Ord River rock bar below Kununurra is best on the run-out tide. Barra stack at the downstream lip — sonar shows multiple arches at 3–6m at the drop.",
  "Fitzroy River is clear water lower reaches — sonar arches are crisper here than Cambridge Gulf. Fat bright U arches over limestone rock = trophy barra.",
  "Side imaging: fish appear as bright marks with a shadow TRAILING AWAY from the boat. Distance from centre line = how far the fish is from you.",
  "Ord River flooded timber (wet season): standing timber shows as columns. Barra arch at the base and crown of each submerged tree. Fish are THERE.",
  "Jewfish sonar: massive single bright arch in turbid harbour water at 5–15m mid-column. Biggest arch on screen in murky conditions. Easy to spot.",
];

function getTodaysSonarTip(date: Date): string {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  return SONAR_TIPS[dayOfYear % SONAR_TIPS.length] ?? SONAR_TIPS[0];
}

// ─── AI daily briefing ────────────────────────────────────────────────────────

async function generateAIBriefing(
  date: string,
  season: WASeasonData,
  moon: MoonData,
  weather: WAWeather | null,
  barraActivity: string,
): Promise<string> {
  try {
    const prompt = `You are an expert WA/Kimberley barramundi fishing guide. Generate a concise, punchy daily fishing briefing for Kimberley anglers for ${date}.

Current conditions:
- Season: ${season.name} — ${season.fishingContext}
- Moon: ${moon.name} (${moon.illuminationPct}% illuminated) — ${moon.fishingRating}
- Barra activity: ${barraActivity}
${weather ? `- Broome weather: ${weather.tempC}°C, ${weather.conditions}, wind ${weather.windDir} ${weather.windSpeedKmh}km/h, pressure ${weather.pressureHpa}hPa ${weather.pressureTrend}` : "- Broome weather: unavailable"}
- Water temp estimate: ${season.waterTempRange}

Write 2–3 punchy sentences covering: what conditions are doing to fish behaviour, where to focus (structure, depth, tide phase), and one specific lure/technique recommendation. Use WA/Kimberley fishing slang. Sound like a knowledgeable local guide, not a textbook. Max 60 words.`;

    const response = await openai.chat.completions.create({
      model: getModel("mid"),
      max_completion_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0]?.message?.content?.trim() ?? season.fishingContext;
  } catch (err) {
    logger.warn({ err }, "AI briefing generation failed — using season context");
    return `${season.emoji} ${season.name} conditions. ${season.fishingContext} ${season.topTechnique}`;
  }
}

// ─── Main refresh function ────────────────────────────────────────────────────

export async function refreshDailyConditions(): Promise<void> {
  const now = new Date();

  // WA is UTC+8 (no DST)
  const waOffsetMs = 8 * 60 * 60 * 1000;
  const waNow = new Date(now.getTime() + waOffsetMs);
  const dateStr = waNow.toISOString().slice(0, 10);
  const timeStr = waNow.toISOString().slice(11, 16) + " AWST";

  logger.info({ date: dateStr }, "Daily conditions refresh starting…");

  const [moon, season, weather] = await Promise.all([
    Promise.resolve(computeMoon(waNow)),
    Promise.resolve(computeWASeason(waNow)),
    fetchWAWeather(),
  ]);

  const barraActivity  = computeBarraActivity(moon, season, weather);
  const sonarTip       = getTodaysSonarTip(waNow);
  const aiBriefing     = await generateAIBriefing(dateStr, season, moon, weather, barraActivity);

  // Schedule next refresh at next WA midnight
  const tomorrowMidnightWA = new Date(waNow);
  tomorrowMidnightWA.setHours(24, 0, 1, 0); // next midnight +1s
  const msUntilMidnight = tomorrowMidnightWA.getTime() - waNow.getTime();
  const nextRefreshISO = new Date(now.getTime() + msUntilMidnight).toISOString();

  _refreshCount++;

  _cache = {
    date: dateStr,
    waLocalTime: timeStr,
    season,
    moon,
    weather,
    barraActivity,
    sonarTip,
    aiBriefing,
    lastRefreshed: now.toISOString(),
    nextRefresh: nextRefreshISO,
    refreshCount: _refreshCount,
  };

  logger.info(
    { date: dateStr, moon: moon.name, season: season.name, nextRefresh: nextRefreshISO },
    "Daily conditions refreshed successfully"
  );

  // Schedule next auto-refresh
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    refreshDailyConditions().catch((err) =>
      logger.error({ err }, "Scheduled daily refresh failed")
    );
  }, msUntilMidnight);
}
