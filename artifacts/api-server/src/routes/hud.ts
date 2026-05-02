/**
 * GET  /hud              — smart-glass HUD HTML (8 rotating brain panels, 20s each)
 * POST /api/hud/update   — app pushes latest scan result
 * POST /api/hud/brain    — manual brain compilation trigger
 * GET  /api/hud/data     — glasses poll for latest BrainHudState JSON
 * GET  /api/hud/events   — SSE stream (full BrainHudState on every brain tick)
 */

import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, communityInsights } from "@workspace/db";
import { desc } from "drizzle-orm";
import { getModel } from "../lib/models.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface HudData {
  species:       string;
  fishCount:     number;
  depth:         string;
  confidence:    number;
  suggestion:    string;
  archCount?:    number;
  archShape?:    string | null;
  sonarMode?:    string | null;
  waterTemp?:    string;
  bottomType?:   string;
  lure?:         string;
  crocAlert?:    boolean;
  crocWarning?:  string | null;
  birdAlert?:    string | null;
  birdActivity?: string | null;
  barraPct?:     number | null;
  baitSchool?:   boolean | null;
  waterClarity?: string | null;
  region?:       "wa" | "nt" | "nq" | null;
  source?:       "live" | "boat" | "cam2";
  updatedAt:     number;
}

interface BrainTarget {
  targetSpecies:   string;
  targetDepth:     string;
  targetLure:      string;
  targetTechnique: string;
  castZone:        string;
  confidence:      number;
  urgency:         "NOW" | "SOON" | "LATER";
  reasoning:       string;
  tideNote:        string;
  seasonNote:      string;
  communityNote:   string;
  compiledAt:      number;
}

interface TideContext {
  port:      string;
  state:     "rising" | "falling" | "high" | "low";
  phase:     string;
  nextTide:  { type: string; time: string; height: number } | null;
  fetchedAt: number;
}

interface CommunityContext {
  hotSpecies:  { species: string; count: number; trend: string }[];
  tips:        string[];
  summary:     string;
  reportCount: number;
}

interface EnvContext {
  month:     number;
  hour:      number;
  season:    string;
  timeOfDay: string;
  moonPhase: string;
}

interface BrainHudState {
  scan:           HudData | null;
  brain:          BrainTarget | null;
  tide:           TideContext | null;
  community:      CommunityContext | null;
  env:            EnvContext;
  updatedAt:      number;
  brainUpdatedAt: number;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

let latest: HudData | null = null;
let brainState: BrainTarget | null = null;
let tideCache: TideContext | null = null;
let communityCache: CommunityContext | null = null;

const sseClients: Set<import("express").Response> = new Set();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeEnv(): EnvContext {
  const now = new Date();
  const month = now.getMonth() + 1;
  const hour  = now.getHours();

  const season =
    month >= 5 && month <= 9  ? "Dry Season" :
    month >= 10 && month <= 11 ? "Build-Up"  : "Wet Season";

  const timeOfDay =
    hour >= 4  && hour < 7  ? "Dawn"      :
    hour >= 7  && hour < 12 ? "Morning"   :
    hour >= 12 && hour < 14 ? "Midday"    :
    hour >= 14 && hour < 17 ? "Afternoon" :
    hour >= 17 && hour < 20 ? "Dusk"      : "Night";

  // Simple Julian Day moon phase calculation
  const JD = now.getTime() / 86400000 + 2440587.5;
  const raw = ((JD - 2451550.1) / 29.530588853) % 1;
  const norm = raw < 0 ? raw + 1 : raw;
  const moonPhase =
    norm < 0.0625 || norm >= 0.9375 ? "New Moon 🌑"     :
    norm < 0.1875                    ? "Waxing Crescent 🌒" :
    norm < 0.3125                    ? "First Quarter 🌓"   :
    norm < 0.4375                    ? "Waxing Gibbous 🌔"  :
    norm < 0.5625                    ? "Full Moon 🌕"       :
    norm < 0.6875                    ? "Waning Gibbous 🌖"  :
    norm < 0.8125                    ? "Last Quarter 🌗"    :
                                       "Waning Crescent 🌘";

  return { month, hour, season, timeOfDay, moonPhase };
}

async function fetchTideContext(region: string): Promise<TideContext | null> {
  const portMap: Record<string, string> = { wa: "broome", nt: "darwin", nq: "karumba" };
  const port = portMap[region] ?? "darwin";
  const base = `http://localhost:${process.env.PORT ?? 3001}`;

  try {
    const r = await fetch(`${base}/api/tides?port=${port}&days=1`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;

    interface TideEntry { time: string; type: string; height: number; timestamp: number; }
    interface TideDay { date: string; tides: TideEntry[]; }
    interface TidesResponse { data?: TideDay[]; tides?: TideDay[]; }

    const data = await r.json() as TidesResponse;
    // API returns { data: [...], port, portKey } — fall back to .tides for compat
    const allTides = (data.data ?? data.tides ?? []).flatMap((d: TideDay) => d.tides ?? []);
    allTides.sort((a, b) => a.timestamp - b.timestamp);

    const now = Date.now();
    const past   = allTides.filter(t => t.timestamp <= now);
    const future = allTides.filter(t => t.timestamp  > now);
    const lastTide = past[past.length - 1] ?? null;
    const nextTide = future[0] ?? null;

    let state: TideContext["state"] = "rising";
    let phase = "Tide data available";

    if (lastTide && nextTide) {
      state = lastTide.type === "LW" ? "rising" : "falling";
      const elapsed  = (now - lastTide.timestamp) / 60000;
      const total    = (nextTide.timestamp - lastTide.timestamp) / 60000;
      const progress = elapsed / total;

      if (progress < 0.08) {
        state = lastTide.type === "LW" ? "low" : "high";
        phase = lastTide.type === "LW"
          ? "Just turned LOW — run-out complete, starting rise"
          : "Just turned HIGH — prime barra window, starting fall";
      } else if (progress > 0.92) {
        phase = nextTide.type === "HW"
          ? "Approaching HIGH — best barra casting NOW"
          : "Approaching LOW — creek mouths & holes firing";
      } else if (state === "rising") {
        phase = progress < 0.5
          ? `Rising (${Math.round(progress * 100)}%) — tide building`
          : `Rising strongly (${Math.round(progress * 100)}%) — fish moving onto flats`;
      } else {
        phase = progress < 0.5
          ? `Falling (${Math.round(progress * 100)}%) — run-out starting`
          : `Falling hard (${Math.round(progress * 100)}%) — bait washing through structure`;
      }
    }

    return {
      port,
      state,
      phase,
      nextTide: nextTide
        ? { type: nextTide.type, time: nextTide.time, height: nextTide.height }
        : null,
      fetchedAt: now,
    };
  } catch {
    return null;
  }
}

async function fetchCommunityContext(): Promise<CommunityContext | null> {
  try {
    const rows = await db
      .select()
      .from(communityInsights)
      .orderBy(desc(communityInsights.generatedAt))
      .limit(1);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      hotSpecies:  (r.hotSpecies  as { species: string; count: number; trend: string }[]) ?? [],
      tips:        (r.tips        as string[]) ?? [],
      summary:     r.summary ?? "",
      reportCount: r.reportCount ?? 0,
    };
  } catch {
    return null;
  }
}

async function compileBrain(
  scan: HudData | null,
  tide: TideContext | null,
  community: CommunityContext | null,
  env: EnvContext,
): Promise<BrainTarget | null> {
  const regionNames: Record<string, string> = {
    wa:  "Western Australia (Kimberley / Pilbara / Ord River)",
    nt:  "Northern Territory (Darwin / Top End / Daly River / Mary River)",
    nq:  "Far North Queensland (Gulf Country / Cape York / Cairns / Daintree)",
  };
  const regionName = regionNames[scan?.region ?? "nt"] ?? "Northern Australia";

  const prompt = `You are the HookVision Brain — expert AI for ${regionName} tropical sport fishing.

Compile ALL data sources below into ONE precise predictive fishing target for this angler RIGHT NOW.

━━━ SONAR SCAN ━━━
${scan ? `Species detected: ${scan.species}
Fish count: ${scan.fishCount}  |  Depth: ${scan.depth}  |  Confidence: ${Math.round((scan.confidence ?? 0) * 100)}%
Arches: ${scan.archCount ?? 0}  |  Arch shape: ${scan.archShape ?? "not analysed"}
Barra profile match: ${scan.barraPct ?? 0}%
Water temp: ${scan.waterTemp ?? "unknown"}  |  Bottom: ${scan.bottomType ?? "unknown"}
Bait school sonar: ${scan.baitSchool ? "YES — bait present" : "not detected"}
Water clarity: ${scan.waterClarity ?? "not reported"}
Current lure: ${scan.lure ?? "not specified"}
AI suggestion: ${scan.suggestion ?? "none"}` : "No sonar scan data available yet."}

━━━ TIDES ━━━
${tide ? `Port: ${tide.port}  |  State: ${tide.state}
Phase: ${tide.phase}
Next: ${tide.nextTide ? `${tide.nextTide.type} at ${tide.nextTide.time} (${tide.nextTide.height}m)` : "unknown"}` : "Tide data unavailable"}

━━━ ENVIRONMENT ━━━
Season: ${env.season}  |  Time: ${env.timeOfDay}  |  Moon: ${env.moonPhase}

━━━ ACTIVE ALERTS ━━━
Croc alert: ${scan?.crocAlert ? "🚨 YES — " + (scan.crocWarning ?? "exercise extreme caution") : "None"}
Bird activity: ${scan?.birdAlert ?? scan?.birdActivity ?? "None reported"}

━━━ COMMUNITY INTELLIGENCE ━━━
${community
  ? `Reports in database: ${community.reportCount}
Top species: ${community.hotSpecies.slice(0, 4).map(s => `${s.species} (${s.count})`).join(", ")}
Community tip: ${community.tips[0] ?? "none"}
Summary: ${community.summary}`
  : "No community data available."}

Based on ALL of the above, give ONE precise predictive fishing target. Respond ONLY with this exact JSON (no markdown, no fences):
{"targetSpecies":"exact species","targetDepth":"e.g. 2-4m near snag","targetLure":"specific lure name, size, colour","targetTechnique":"exact retrieve — style, speed, cadence","castZone":"exactly where to cast","confidence":0.85,"urgency":"NOW","reasoning":"2 sentences combining tides+season+sonar+community into expert justification","tideNote":"1 sentence on why this tidal state matters right now","seasonNote":"1 sentence on seasonal context","communityNote":"1 sentence referencing community data or regional knowledge"}`;

  try {
    const completion = await openai.chat.completions.create({
      model:    getModel("mid"),
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 450,
      response_format: { type: "json_object" },
    });
    const raw    = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<BrainTarget>;
    return {
      targetSpecies:   parsed.targetSpecies   ?? "Barramundi",
      targetDepth:     parsed.targetDepth     ?? "2-5m",
      targetLure:      parsed.targetLure      ?? "Surface walker",
      targetTechnique: parsed.targetTechnique ?? "Twitch and pause",
      castZone:        parsed.castZone        ?? "Structure edges",
      confidence:      typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      urgency:         (["NOW","SOON","LATER"] as const).includes(parsed.urgency as "NOW"|"SOON"|"LATER")
                         ? (parsed.urgency as BrainTarget["urgency"]) : "SOON",
      reasoning:      parsed.reasoning      ?? "",
      tideNote:        parsed.tideNote       ?? "",
      seasonNote:      parsed.seasonNote     ?? "",
      communityNote:   parsed.communityNote  ?? "",
      compiledAt:      Date.now(),
    };
  } catch (err) {
    logger.warn({ err }, "HUD brain compilation failed");
    return null;
  }
}

function buildFullState(): BrainHudState {
  return {
    scan:           latest,
    brain:          brainState,
    tide:           tideCache,
    community:      communityCache,
    env:            computeEnv(),
    updatedAt:      latest?.updatedAt ?? 0,
    brainUpdatedAt: brainState?.compiledAt ?? 0,
  };
}

function broadcastFull(state: BrainHudState) {
  const msg = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

// ─── Brain loop (every 20 seconds) ───────────────────────────────────────────

let isCompiling = false;

async function runBrainLoop() {
  if (isCompiling) return;
  isCompiling = true;
  try {
    const env     = computeEnv();
    const region  = latest?.region ?? "nt";

    const [tide, community] = await Promise.all([
      fetchTideContext(region),
      fetchCommunityContext(),
    ]);

    if (tide)      tideCache      = tide;
    if (community) communityCache = community;

    const brain = await compileBrain(latest, tideCache, communityCache, env);
    if (brain) brainState = brain;

    broadcastFull(buildFullState());
    logger.info({ urgency: brainState?.urgency, confidence: brainState?.confidence }, "HUD brain compiled");
  } catch (err) {
    logger.warn({ err }, "HUD brain loop error");
  } finally {
    isCompiling = false;
  }
}

// First compilation after 6s (server warmup), then every 20s
setTimeout(() => { runBrainLoop().catch(() => {}); }, 6000);
setInterval(() => { runBrainLoop().catch(() => {}); }, 20000);

// ─── POST /api/hud/update ─────────────────────────────────────────────────────
router.post("/hud/update", (req, res) => {
  const body = req.body as Partial<HudData>;
  latest = {
    species:      body.species      ?? "—",
    fishCount:    body.fishCount    ?? 0,
    depth:        body.depth        ?? "—",
    confidence:   body.confidence   ?? 0,
    suggestion:   body.suggestion   ?? "",
    archCount:    body.archCount,
    archShape:    body.archShape    ?? null,
    sonarMode:    body.sonarMode    ?? null,
    waterTemp:    body.waterTemp,
    bottomType:   body.bottomType,
    lure:         body.lure,
    crocAlert:    body.crocAlert    ?? false,
    crocWarning:  body.crocWarning  ?? null,
    birdAlert:    body.birdAlert    ?? null,
    birdActivity: body.birdActivity ?? null,
    barraPct:     body.barraPct     ?? null,
    baitSchool:   body.baitSchool   ?? null,
    waterClarity: body.waterClarity ?? null,
    region:       body.region       ?? null,
    source:       body.source       ?? "live",
    updatedAt:    Date.now(),
  };
  // Trigger immediate brain compilation after a new scan
  if (!isCompiling) {
    setTimeout(() => { runBrainLoop().catch(() => {}); }, 300);
  }
  res.json({ ok: true });
});

// ─── POST /api/hud/brain (manual trigger) ────────────────────────────────────
router.post("/hud/brain", async (req, res) => {
  try {
    if (!isCompiling) {
      await runBrainLoop();
    }
    res.json({ ok: true, brain: brainState, tide: tideCache });
  } catch (err) {
    res.status(500).json({ error: "Brain compilation failed" });
  }
});

// ─── GET /api/hud/data ────────────────────────────────────────────────────────
router.get("/hud/data", (_req, res) => {
  res.json(buildFullState());
});

// ─── GET /api/hud/events (SSE) ────────────────────────────────────────────────
router.get("/hud/events", (req, res) => {
  res.setHeader("Content-Type",       "text/event-stream");
  res.setHeader("Cache-Control",      "no-cache");
  res.setHeader("Connection",         "keep-alive");
  res.setHeader("X-Accel-Buffering",  "no");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify(buildFullState())}\n\n`);
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

// ─── GET /hud — smart-glass HUD HTML ──────────────────────────────────────────
router.get("/hud", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>HookVision BRAIN HUD</title>
<style>
  :root {
    --navy:   #050d1c;
    --teal:   #00d4aa;
    --blue:   #00a8ff;
    --gold:   #ffd700;
    --red:    #ff3b30;
    --orange: #ff8800;
    --amber:  #ffb300;
    --cyan:   #00e5ff;
    --green:  #34c759;
    --purple: #bf5af2;
    --dim:    rgba(255,255,255,0.45);
    --dimmer: rgba(255,255,255,0.25);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%; height: 100%;
    background: var(--navy);
    color: #fff;
    font-family: system-ui, -apple-system, "SF Pro Display", sans-serif;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  body { display: flex; flex-direction: column; height: 100%; }

  /* ── Header ────────────────────────────────────────────────── */
  #header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px 6px;
    border-bottom: 1px solid #ffffff0d;
    flex-shrink: 0;
  }
  #brand { font-size: 11px; font-weight: 900; letter-spacing: 3px; color: var(--teal); text-transform: uppercase; }
  #header-right { display: flex; align-items: center; gap: 8px; }
  #time { font-size: 12px; color: var(--dim); font-weight: 600; font-variant-numeric: tabular-nums; }
  #live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #ffffff1a; transition: background 0.5s;
  }
  #live-dot.on { background: var(--teal); box-shadow: 0 0 8px var(--teal); animation: dotpulse 2s infinite; }
  #live-dot.brain { background: var(--gold); box-shadow: 0 0 8px var(--gold); animation: dotpulse 1s infinite; }

  /* ── Waiting screen ─────────────────────────────────────────── */
  #waiting {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
    padding: 24px;
  }
  #waiting.hidden { display: none; }
  .spinner {
    width: 40px; height: 40px;
    border: 3px solid #ffffff12;
    border-top-color: var(--teal);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  #w-title { font-size: 15px; font-weight: 800; letter-spacing: 2px; color: var(--dim); text-transform: uppercase; }
  #w-sub { font-size: 12px; color: var(--dimmer); text-align: center; line-height: 1.5; }

  /* ── Main HUD wrapper ───────────────────────────────────────── */
  #hud {
    flex: 1; display: none; flex-direction: column;
    min-height: 0;
  }
  #hud.show { display: flex; }

  /* ── Panel area ─────────────────────────────────────────────── */
  #panel-area { flex: 1; position: relative; overflow: hidden; min-height: 0; }

  .panel {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    padding: 12px 16px 10px;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: none;
  }
  .panel.active { opacity: 1; pointer-events: auto; }

  /* ── Panel label ────────────────────────────────────────────── */
  .panel-label {
    font-size: 9px; font-weight: 900; letter-spacing: 3px;
    text-transform: uppercase; display: flex; align-items: center; gap: 6px;
  }
  .panel-label::after {
    content: ""; flex: 1; height: 1px; background: currentColor; opacity: 0.2;
  }

  /* ── Large hero value ───────────────────────────────────────── */
  .hero-val { font-size: 36px; font-weight: 900; line-height: 1; letter-spacing: -0.5px; }
  .hero-sub { font-size: 12px; font-weight: 500; color: var(--dim); margin-top: 2px; }

  /* ── Metrics grid ───────────────────────────────────────────── */
  .metric-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
  }
  .metric-grid.col3 { grid-template-columns: repeat(3, 1fr); }
  .metric-grid.col2 { grid-template-columns: repeat(2, 1fr); }
  .metric-box {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1px; padding: 8px 4px;
    border: 1px solid #ffffff10; border-radius: 10px;
    background: #ffffff06;
  }
  .metric-box.accent-teal  { border-color: #00d4aa22; background: #00d4aa08; }
  .metric-box.accent-gold  { border-color: #ffd70022; background: #ffd70008; }
  .metric-box.accent-blue  { border-color: #00a8ff22; background: #00a8ff08; }
  .metric-box.accent-red   { border-color: #ff3b3022; background: #ff3b3008; }
  .metric-box.accent-amber { border-color: #ffb30022; background: #ffb30008; }
  .mval { font-size: 20px; font-weight: 900; line-height: 1; }
  .mlbl { font-size: 8px; font-weight: 700; letter-spacing: 1.5px; color: var(--dim); text-transform: uppercase; white-space: nowrap; }

  /* ── Confidence bar ─────────────────────────────────────────── */
  .conf-row { display: flex; align-items: center; gap: 8px; }
  .conf-track { flex: 1; height: 4px; background: #ffffff12; border-radius: 2px; overflow: hidden; }
  .conf-fill { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
  .conf-pct { font-size: 14px; font-weight: 800; }

  /* ── Text blocks ────────────────────────────────────────────── */
  .info-block {
    padding: 9px 12px;
    border-left: 3px solid;
    border-radius: 0 9px 9px 0;
    font-size: 12px; font-weight: 500; line-height: 1.5;
    color: rgba(255,255,255,0.82);
  }
  .tag {
    display: inline-block; font-size: 9px; font-weight: 800;
    letter-spacing: 1px; text-transform: uppercase;
    padding: 3px 8px; border-radius: 20px; border: 1.5px solid;
  }
  .tag.now    { color: var(--green);  border-color: var(--green);  background: #34c75918; }
  .tag.soon   { color: var(--amber);  border-color: var(--amber);  background: #ffb30018; }
  .tag.later  { color: var(--dim);    border-color: #ffffff30;     background: #ffffff08; }
  .tag.croc   { color: var(--red);    border-color: var(--red);    background: #ff3b3018; animation: tagpulse 1.5s infinite; }
  .tag.clear  { color: var(--green);  border-color: var(--green);  background: #34c75912; }
  .tag.birds  { color: var(--cyan);   border-color: var(--cyan);   background: #00e5ff12; }
  .tag.bait   { color: var(--gold);   border-color: var(--gold);   background: #ffd70012; }

  .species-name { font-size: 28px; font-weight: 900; line-height: 1.1; word-break: break-word; }
  .lure-text { font-size: 14px; font-weight: 700; color: var(--gold); }
  .depth-text { font-size: 13px; font-weight: 600; color: var(--blue); }
  .technique-text { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.75); line-height: 1.45; }

  /* ── Community list ─────────────────────────────────────────── */
  .sp-list { display: flex; flex-direction: column; gap: 5px; }
  .sp-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .sp-name { font-size: 13px; font-weight: 700; }
  .sp-bar-wrap { flex: 1; height: 3px; background: #ffffff12; border-radius: 2px; overflow: hidden; max-width: 80px; }
  .sp-bar { height: 100%; background: var(--cyan); border-radius: 2px; }
  .sp-cnt { font-size: 10px; font-weight: 700; color: var(--dim); min-width: 28px; text-align: right; }

  /* ── Footer: panel nav + progress ──────────────────────────── */
  #footer {
    flex-shrink: 0;
    padding: 6px 16px 10px;
    border-top: 1px solid #ffffff0d;
    display: flex; flex-direction: column; gap: 5px;
  }
  #panel-dots { display: flex; gap: 5px; justify-content: center; }
  .pdot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #ffffff1a; transition: background 0.3s, transform 0.3s;
  }
  .pdot.active { background: currentColor; transform: scale(1.4); }
  #prog-track { width: 100%; height: 2px; background: #ffffff0f; border-radius: 1px; overflow: hidden; }
  #prog-bar { height: 100%; background: var(--teal); border-radius: 1px; transition: width 1s linear; }
  #panel-name-row { display: flex; justify-content: space-between; align-items: center; }
  #panel-name-label { font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--dim); }
  #source-info { font-size: 9px; color: var(--dimmer); }

  /* ── Animations ─────────────────────────────────────────────── */
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes dotpulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes tagpulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
</style>
</head>
<body>

<div id="header">
  <div id="brand">⚡ HookVision Brain</div>
  <div id="header-right">
    <div id="time">--:--:--</div>
    <div id="live-dot"></div>
  </div>
</div>

<div id="waiting">
  <div class="spinner"></div>
  <div id="w-title">Brain Initialising</div>
  <div id="w-sub">Compiling tides · community · AI prediction<br>Tap Scan in HookVision to push sonar data</div>
</div>

<div id="hud">
  <div id="panel-area">

    <!-- Panel 0: SONAR -->
    <div class="panel" id="p0">
      <div class="panel-label" style="color:var(--teal)">Sonar Scan</div>
      <div class="species-name" id="s-species">—</div>
      <div class="conf-row">
        <div class="conf-track"><div class="conf-fill" id="s-conf-bar" style="background:var(--teal);width:0%"></div></div>
        <div class="conf-pct" id="s-conf-pct" style="color:var(--teal)">0%</div>
      </div>
      <div class="metric-grid" style="margin-top:2px">
        <div class="metric-box accent-teal"><div class="mval" id="s-fish">0</div><div class="mlbl">Fish</div></div>
        <div class="metric-box accent-blue"><div class="mval" id="s-depth">—</div><div class="mlbl">Depth</div></div>
        <div class="metric-box accent-teal"><div class="mval" id="s-arches">—</div><div class="mlbl">Arches</div></div>
        <div class="metric-box accent-gold"><div class="mval" id="s-barra">—</div><div class="mlbl">Barra%</div></div>
      </div>
      <div class="info-block" id="s-suggestion" style="border-color:var(--teal);background:#00d4aa0a"></div>
    </div>

    <!-- Panel 1: BARRA PROFILE -->
    <div class="panel" id="p1">
      <div class="panel-label" style="color:var(--gold)">Barra Profile</div>
      <div style="display:flex;align-items:baseline;gap:10px">
        <div class="hero-val" id="b-pct" style="color:var(--gold)">—</div>
        <div style="font-size:14px;color:var(--dim);font-weight:600">% match</div>
      </div>
      <div class="metric-grid col2" style="margin-top:4px">
        <div class="metric-box accent-gold"><div class="mval" id="b-arches" style="color:var(--gold)">—</div><div class="mlbl">Arches</div></div>
        <div class="metric-box accent-gold"><div class="mval" id="b-depth" style="color:var(--gold)">—</div><div class="mlbl">Depth</div></div>
      </div>
      <div class="info-block" id="b-shape" style="border-color:var(--gold);background:#ffd7000a">Arch shape analysis loading…</div>
      <div class="info-block" id="b-bottom" style="border-color:#ffffff20;background:#ffffff05;font-size:11px"></div>
    </div>

    <!-- Panel 2: ENVIRONMENT -->
    <div class="panel" id="p2">
      <div class="panel-label" style="color:var(--blue)">Environment</div>
      <div class="hero-val" id="e-tide-phase" style="color:var(--blue);font-size:18px;line-height:1.3">Loading tide data…</div>
      <div class="metric-grid col3" style="margin-top:4px">
        <div class="metric-box accent-blue">
          <div class="mval" id="e-tide-state" style="color:var(--blue);font-size:14px">—</div>
          <div class="mlbl">Tide</div>
        </div>
        <div class="metric-box">
          <div class="mval" id="e-next-type" style="font-size:14px">—</div>
          <div class="mlbl">Next</div>
        </div>
        <div class="metric-box">
          <div class="mval" id="e-temp" style="font-size:16px">—</div>
          <div class="mlbl">Water°</div>
        </div>
      </div>
      <div class="info-block" id="e-next-detail" style="border-color:var(--blue);background:#00a8ff0a"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px">
        <span id="e-season" class="tag" style="color:var(--teal);border-color:var(--teal);background:#00d4aa0f"></span>
        <span id="e-moon" class="tag" style="color:var(--dim);border-color:#ffffff25;background:#ffffff08"></span>
        <span id="e-tod" class="tag" style="color:var(--amber);border-color:var(--amber);background:#ffb3000f"></span>
      </div>
    </div>

    <!-- Panel 3: BIRDS & BAIT -->
    <div class="panel" id="p3">
      <div class="panel-label" style="color:var(--cyan)">Birds & Bait</div>
      <div id="p3-none" style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:8px">
        <div style="font-size:15px;color:var(--dim);font-weight:600">No surface activity detected</div>
        <div style="font-size:12px;color:var(--dimmer)">Scan with insta360 camera or boat mode to detect bird feeding activity and bait balls.</div>
      </div>
      <div id="p3-active" style="display:none;flex-direction:column;gap:8px">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span id="p3-bird-tag" class="tag birds" style="display:none"></span>
          <span id="p3-bait-tag" class="tag bait" style="display:none"></span>
        </div>
        <div class="info-block" id="p3-bird-detail" style="border-color:var(--cyan);background:#00e5ff0a"></div>
      </div>
      <div class="metric-grid col2" style="margin-top:auto">
        <div class="metric-box">
          <div class="mval" id="p3-clarity" style="font-size:14px;color:var(--blue)">—</div>
          <div class="mlbl">Clarity</div>
        </div>
        <div class="metric-box">
          <div class="mval" id="p3-mode" style="font-size:12px;color:var(--dim)">—</div>
          <div class="mlbl">Sonar Mode</div>
        </div>
      </div>
    </div>

    <!-- Panel 4: CROC & SAFETY -->
    <div class="panel" id="p4">
      <div class="panel-label" style="color:var(--red)">Croc & Safety</div>
      <div id="p4-clear" style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px">
        <div style="font-size:48px">✅</div>
        <div style="font-size:22px;font-weight:900;color:var(--green);letter-spacing:1px">AREA CLEAR</div>
        <div style="font-size:12px;color:var(--dim);text-align:center">No croc threats detected.<br>Always stay vigilant near water.</div>
      </div>
      <div id="p4-alert" style="display:none;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:40px">🐊</div>
          <div>
            <div style="font-size:22px;font-weight:900;color:var(--red);letter-spacing:1px">CROC ALERT</div>
            <div style="font-size:11px;color:var(--dim)">Saltwater crocodile detected</div>
          </div>
        </div>
        <div class="info-block" id="p4-warning" style="border-color:var(--red);background:#ff3b3012;font-weight:600"></div>
        <div class="info-block" style="border-color:#ffffff20;background:#ffffff07;font-size:11px;color:var(--dim)">Keep clear of water's edge. Do not attempt to retrieve lures near croc sighting. Move position immediately.</div>
      </div>
    </div>

    <!-- Panel 5: WATER -->
    <div class="panel" id="p5">
      <div class="panel-label" style="color:var(--blue)">Water Conditions</div>
      <div class="metric-grid col2">
        <div class="metric-box accent-blue">
          <div class="mval" id="w-temp" style="color:var(--blue)">—</div>
          <div class="mlbl">Water Temp</div>
        </div>
        <div class="metric-box">
          <div class="mval" id="w-clarity" style="font-size:14px">—</div>
          <div class="mlbl">Clarity</div>
        </div>
      </div>
      <div class="metric-grid col2" style="margin-top:0">
        <div class="metric-box">
          <div class="mval" id="w-bottom" style="font-size:13px;color:var(--amber)">—</div>
          <div class="mlbl">Bottom Type</div>
        </div>
        <div class="metric-box">
          <div class="mval" id="w-mode" style="font-size:12px;color:var(--dim)">—</div>
          <div class="mlbl">Sonar Mode</div>
        </div>
      </div>
      <div class="info-block" id="w-lure" style="border-color:var(--amber);background:#ffb3000a"></div>
    </div>

    <!-- Panel 6: COMMUNITY BRAIN -->
    <div class="panel" id="p6">
      <div class="panel-label" style="color:var(--cyan)">Community Brain</div>
      <div id="p6-none" style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:8px">
        <div style="font-size:15px;color:var(--dim);font-weight:600">No community data yet</div>
        <div style="font-size:12px;color:var(--dimmer)">Submit scans to build the community intelligence database.</div>
      </div>
      <div id="p6-data" style="display:none;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div style="font-size:11px;font-weight:700;color:var(--dim)">TOP SPECIES</div>
          <div style="font-size:10px;color:var(--dimmer)" id="p6-count">0 reports</div>
        </div>
        <div class="sp-list" id="p6-species"></div>
        <div class="info-block" id="p6-tip" style="border-color:var(--cyan);background:#00e5ff0a;font-size:11px"></div>
      </div>
    </div>

    <!-- Panel 7: AI TARGET -->
    <div class="panel" id="p7">
      <div class="panel-label" style="color:var(--gold)">AI Predictive Target</div>
      <div id="p7-loading" style="flex:1;display:flex;align-items:center;justify-content:center;gap:10px">
        <div class="spinner" style="border-top-color:var(--gold)"></div>
        <div style="font-size:13px;color:var(--dim)">Compiling brain…</div>
      </div>
      <div id="p7-data" style="display:none;flex-direction:column;gap:7px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
          <div class="species-name" id="t-species" style="color:var(--gold)">—</div>
          <span id="t-urgency" class="tag now">NOW</span>
        </div>
        <div class="conf-row">
          <div class="conf-track"><div class="conf-fill" id="t-conf-bar" style="background:var(--gold);width:0%"></div></div>
          <div class="conf-pct" id="t-conf-pct" style="color:var(--gold)">0%</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px">
          <div style="flex:1;min-width:0">
            <div style="font-size:8px;font-weight:700;letter-spacing:1.5px;color:var(--dim);text-transform:uppercase;margin-bottom:2px">Depth</div>
            <div class="depth-text" id="t-depth">—</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:8px;font-weight:700;letter-spacing:1.5px;color:var(--dim);text-transform:uppercase;margin-bottom:2px">Lure</div>
            <div class="lure-text" id="t-lure">—</div>
          </div>
        </div>
        <div>
          <div style="font-size:8px;font-weight:700;letter-spacing:1.5px;color:var(--dim);text-transform:uppercase;margin-bottom:2px">Cast Zone</div>
          <div style="font-size:12px;font-weight:700;color:var(--cyan)" id="t-zone">—</div>
        </div>
        <div>
          <div style="font-size:8px;font-weight:700;letter-spacing:1.5px;color:var(--dim);text-transform:uppercase;margin-bottom:2px">Technique</div>
          <div class="technique-text" id="t-technique">—</div>
        </div>
        <div class="info-block" id="t-reasoning" style="border-color:var(--gold);background:#ffd70009;font-size:11px"></div>
      </div>
    </div>

  </div><!-- /panel-area -->

  <div id="footer">
    <div id="panel-name-row">
      <div id="panel-name-label">SONAR</div>
      <div id="source-info">—</div>
    </div>
    <div id="prog-track"><div id="prog-bar" style="width:100%"></div></div>
    <div id="panel-dots">
      <div class="pdot" style="color:var(--teal)"></div>
      <div class="pdot" style="color:var(--gold)"></div>
      <div class="pdot" style="color:var(--blue)"></div>
      <div class="pdot" style="color:var(--cyan)"></div>
      <div class="pdot" style="color:var(--red)"></div>
      <div class="pdot" style="color:var(--blue)"></div>
      <div class="pdot" style="color:var(--cyan)"></div>
      <div class="pdot" style="color:var(--gold)"></div>
    </div>
  </div>
</div><!-- /hud -->

<script>
// ─── State ────────────────────────────────────────────────────────────────────
var S = { scan: null, brain: null, tide: null, community: null, env: null, updatedAt: 0, brainUpdatedAt: 0 };
var PANEL_COUNT  = 8;
var PANEL_SECS   = 20;
var panelIdx     = 0;
var panelElapsed = 0;  // seconds elapsed in current panel

var PANEL_NAMES  = ["Sonar Scan","Barra Profile","Environment","Birds & Bait","Croc & Safety","Water","Community","AI Target"];
var PANEL_COLORS = ["var(--teal)","var(--gold)","var(--blue)","var(--cyan)","var(--red)","var(--blue)","var(--cyan)","var(--gold)"];

// ─── Panel rotation ───────────────────────────────────────────────────────────
function showPanel(idx) {
  document.querySelectorAll(".panel").forEach(function(p, i) {
    p.classList.toggle("active", i === idx);
  });
  var dots = document.querySelectorAll(".pdot");
  dots.forEach(function(d, i) { d.classList.toggle("active", i === idx); });
  document.getElementById("panel-name-label").textContent = PANEL_NAMES[idx];
  document.getElementById("panel-name-label").style.color = PANEL_COLORS[idx];
  panelElapsed = 0;
  updateProgress();
}

function updateProgress() {
  var pct = ((PANEL_SECS - panelElapsed) / PANEL_SECS) * 100;
  document.getElementById("prog-bar").style.width = pct + "%";
  document.getElementById("prog-bar").style.background = PANEL_COLORS[panelIdx];
}

// Advance panel every PANEL_SECS seconds
setInterval(function() {
  panelElapsed++;
  if (panelElapsed >= PANEL_SECS) {
    panelIdx = (panelIdx + 1) % PANEL_COUNT;
    showPanel(panelIdx);
  } else {
    updateProgress();
  }
}, 1000);

// ─── Data application ─────────────────────────────────────────────────────────
function applyState(d) {
  if (!d) return;

  var isNew = (d.updatedAt > S.updatedAt) || (d.brainUpdatedAt > S.brainUpdatedAt);
  S = d;

  // Show main HUD once we have ANY data
  if (d.updatedAt > 0 || d.brainUpdatedAt > 0) {
    document.getElementById("waiting").classList.add("hidden");
    document.getElementById("hud").classList.add("show");
    document.getElementById("live-dot").className = d.brainUpdatedAt > 0 ? "on brain" : "on";
  }

  // Source info footer
  if (d.scan) {
    var srcMap = { live: "📱 Live", boat: "⚓ Boat Mode", cam2: "📺 Cam 2" };
    var ago = d.scan.updatedAt ? Math.round((Date.now() - d.scan.updatedAt) / 1000) : 0;
    document.getElementById("source-info").textContent =
      (srcMap[d.scan.source] || "📱") + " · " + (ago < 5 ? "just now" : ago + "s ago");
  }

  renderPanel0(d.scan);
  renderPanel1(d.scan);
  renderPanel2(d.tide, d.env, d.scan);
  renderPanel3(d.scan);
  renderPanel4(d.scan);
  renderPanel5(d.scan);
  renderPanel6(d.community);
  renderPanel7(d.brain);

  // Auto-jump to TARGET panel when brain first arrives and we're waiting
  if (isNew && d.brain && panelIdx === 0 && S.updatedAt === 0) {
    panelIdx = 7; showPanel(7);
  }
}

// ─── Panel 0: Sonar ───────────────────────────────────────────────────────────
function renderPanel0(s) {
  if (!s) return;
  document.getElementById("s-species").textContent = s.species || "—";
  var pct = Math.round((s.confidence || 0) * 100);
  document.getElementById("s-conf-pct").textContent = pct + "%";
  document.getElementById("s-conf-bar").style.width = pct + "%";
  document.getElementById("s-fish").textContent = s.fishCount ?? "0";
  document.getElementById("s-depth").textContent = s.depth || "—";
  document.getElementById("s-arches").textContent = s.archCount != null ? s.archCount : "—";
  var bp = s.barraPct;
  document.getElementById("s-barra").textContent = bp != null ? bp + "%" : "—";
  document.getElementById("s-barra").style.color = bp != null && bp > 60 ? "var(--gold)" : "inherit";
  document.getElementById("s-suggestion").textContent = s.suggestion || "No suggestion";
}

// ─── Panel 1: Barra Profile ───────────────────────────────────────────────────
function renderPanel1(s) {
  if (!s) return;
  var bp = s.barraPct;
  document.getElementById("b-pct").textContent = bp != null ? bp : "—";
  document.getElementById("b-arches").textContent = s.archCount != null ? s.archCount : "—";
  document.getElementById("b-depth").textContent = s.depth || "—";
  document.getElementById("b-shape").textContent = s.archShape || "No arch shape data — run boat mode scan for trophy barra analysis";
  document.getElementById("b-bottom").textContent = s.bottomType
    ? "Bottom: " + s.bottomType + (s.waterTemp ? "  ·  Temp: " + s.waterTemp : "")
    : (s.waterTemp ? "Water temp: " + s.waterTemp : "");
}

// ─── Panel 2: Environment ─────────────────────────────────────────────────────
function renderPanel2(tide, env, s) {
  if (tide) {
    document.getElementById("e-tide-phase").textContent = tide.phase || "—";
    var stateLabels = { rising: "↑ Rising", falling: "↓ Falling", high: "⬆ HIGH", low: "⬇ LOW" };
    document.getElementById("e-tide-state").textContent = stateLabels[tide.state] || tide.state;
    if (tide.nextTide) {
      document.getElementById("e-next-type").textContent = tide.nextTide.type;
      document.getElementById("e-next-detail").textContent =
        "Next " + tide.nextTide.type + " at " + tide.nextTide.time + " — " + tide.nextTide.height + "m";
    } else {
      document.getElementById("e-next-type").textContent = "—";
      document.getElementById("e-next-detail").textContent = "Tide prediction unavailable";
    }
  }
  document.getElementById("e-temp").textContent = (s && s.waterTemp) ? s.waterTemp : "—";
  if (env) {
    document.getElementById("e-season").textContent = env.season || "";
    document.getElementById("e-moon").textContent   = env.moonPhase || "";
    document.getElementById("e-tod").textContent    = env.timeOfDay || "";
  }
}

// ─── Panel 3: Birds & Bait ────────────────────────────────────────────────────
function renderPanel3(s) {
  if (!s) return;
  var hasBird = !!(s.birdAlert || s.birdActivity);
  var hasBait = !!s.baitSchool;
  var hasActivity = hasBird || hasBait;

  document.getElementById("p3-none").style.display   = hasActivity ? "none"  : "flex";
  document.getElementById("p3-active").style.display = hasActivity ? "flex"  : "none";

  var btag = document.getElementById("p3-bird-tag");
  var bttag = document.getElementById("p3-bait-tag");

  if (hasBird) {
    btag.style.display = "inline-block";
    btag.textContent   = "🐦 " + (s.birdAlert || s.birdActivity);
  } else {
    btag.style.display = "none";
  }

  if (hasBait) {
    bttag.style.display = "inline-block";
    bttag.textContent   = "🐟 Bait School Detected";
  } else {
    bttag.style.display = "none";
  }

  document.getElementById("p3-bird-detail").textContent =
    (s.birdActivity || s.birdAlert || "Surface activity detected") +
    (s.baitSchool ? " · Sonar confirms bait school beneath." : "");

  document.getElementById("p3-clarity").textContent = s.waterClarity || "—";
  document.getElementById("p3-mode").textContent    = s.sonarMode    || "—";
}

// ─── Panel 4: Croc & Safety ───────────────────────────────────────────────────
function renderPanel4(s) {
  if (!s) return;
  document.getElementById("p4-clear").style.display = s.crocAlert ? "none"  : "flex";
  document.getElementById("p4-alert").style.display = s.crocAlert ? "flex"  : "none";
  if (s.crocAlert) {
    document.getElementById("p4-warning").textContent = s.crocWarning || "Crocodile detected — move position immediately";
  }
}

// ─── Panel 5: Water ───────────────────────────────────────────────────────────
function renderPanel5(s) {
  if (!s) return;
  document.getElementById("w-temp").textContent    = s.waterTemp    || "—";
  document.getElementById("w-clarity").textContent = s.waterClarity || "—";
  document.getElementById("w-bottom").textContent  = s.bottomType   || "—";
  document.getElementById("w-mode").textContent    = s.sonarMode    || "—";
  document.getElementById("w-lure").textContent    = s.lure
    ? "Current lure: " + s.lure
    : "No lure data — tap boat mode for lure recommendation";
}

// ─── Panel 6: Community ───────────────────────────────────────────────────────
function renderPanel6(c) {
  var noEl  = document.getElementById("p6-none");
  var datEl = document.getElementById("p6-data");
  if (!c || !c.reportCount) {
    noEl.style.display  = "flex";
    datEl.style.display = "none";
    return;
  }
  noEl.style.display  = "none";
  datEl.style.display = "flex";
  document.getElementById("p6-count").textContent = c.reportCount + " reports";
  document.getElementById("p6-tip").textContent   = c.tips && c.tips[0] ? c.tips[0] : c.summary || "";

  var spEl = document.getElementById("p6-species");
  spEl.innerHTML = "";
  var top = (c.hotSpecies || []).slice(0, 5);
  var maxCnt = top.length ? (top[0].count || 1) : 1;
  top.forEach(function(s) {
    var row = document.createElement("div");
    row.className = "sp-row";
    row.innerHTML =
      '<div class="sp-name">' + s.species + '</div>' +
      '<div class="sp-bar-wrap"><div class="sp-bar" style="width:' + Math.round((s.count / maxCnt) * 100) + '%"></div></div>' +
      '<div class="sp-cnt">' + s.count + '</div>';
    spEl.appendChild(row);
  });
}

// ─── Panel 7: AI Target ───────────────────────────────────────────────────────
function renderPanel7(b) {
  var loadEl = document.getElementById("p7-loading");
  var datEl  = document.getElementById("p7-data");
  if (!b) {
    loadEl.style.display = "flex";
    datEl.style.display  = "none";
    return;
  }
  loadEl.style.display = "none";
  datEl.style.display  = "flex";

  document.getElementById("t-species").textContent   = b.targetSpecies   || "—";
  document.getElementById("t-depth").textContent     = b.targetDepth     || "—";
  document.getElementById("t-lure").textContent      = b.targetLure      || "—";
  document.getElementById("t-zone").textContent      = b.castZone        || "—";
  document.getElementById("t-technique").textContent = b.targetTechnique || "—";

  var urgEl = document.getElementById("t-urgency");
  urgEl.textContent  = b.urgency || "SOON";
  urgEl.className    = "tag " + (b.urgency || "soon").toLowerCase();

  var pct = Math.round((b.confidence || 0) * 100);
  document.getElementById("t-conf-pct").textContent = pct + "%";
  document.getElementById("t-conf-bar").style.width = pct + "%";

  var reasonParts = [b.reasoning, b.tideNote, b.seasonNote, b.communityNote].filter(Boolean);
  document.getElementById("t-reasoning").textContent = reasonParts.join(" ");
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function tick() {
  var n = new Date();
  var h = n.getHours().toString().padStart(2,"0");
  var m = n.getMinutes().toString().padStart(2,"0");
  var s = n.getSeconds().toString().padStart(2,"0");
  document.getElementById("time").textContent = h + ":" + m + ":" + s;
}
setInterval(tick, 1000); tick();

// ─── SSE ──────────────────────────────────────────────────────────────────────
function connectSSE() {
  var es = new EventSource("/api/hud/events");
  es.onmessage = function(e) {
    try { applyState(JSON.parse(e.data)); } catch(ex) {}
  };
  es.onerror = function() { es.close(); setTimeout(connectSSE, 3000); };
}
connectSSE();

// Poll fallback every 5s
setInterval(function() {
  fetch("/api/hud/data").then(function(r){ return r.json(); }).then(applyState).catch(function(){});
}, 5000);

// Initialise panels
showPanel(0);
</script>
</body>
</html>`);
});

export default router;
