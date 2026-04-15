/**
 * GET  /hud         — smart-glass HUD HTML page (auto-refreshes)
 * POST /api/hud/update — app pushes latest scan result
 * GET  /api/hud/data   — glasses poll for latest JSON
 * GET  /api/hud/events — SSE stream (glasses subscribe for instant push)
 */

import { Router } from "express";

const router = Router();

// ─── In-memory HUD state ──────────────────────────────────────────────────────
interface HudData {
  species:       string;
  fishCount:     number;
  depth:         string;
  confidence:    number;
  suggestion:    string;
  archCount?:    number;
  sonarMode?:    string | null;
  waterTemp?:    string;
  bottomType?:   string;
  lure?:         string;
  crocAlert?:    boolean;
  crocWarning?:  string | null;
  birdAlert?:    string | null;
  barraPct?:     number | null;
  source?:       "live" | "boat" | "cam2";
  updatedAt:     number;
}

let latest: HudData | null = null;
const sseClients: Set<any>  = new Set();

function broadcast(data: HudData) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

// ─── POST /hud/update ────────────────────────────────────────────────────────
router.post("/hud/update", (req, res) => {
  const body = req.body as Partial<HudData>;
  latest = {
    species:     body.species     ?? "—",
    fishCount:   body.fishCount   ?? 0,
    depth:       body.depth       ?? "—",
    confidence:  body.confidence  ?? 0,
    suggestion:  body.suggestion  ?? "",
    archCount:   body.archCount,
    sonarMode:   body.sonarMode   ?? null,
    waterTemp:   body.waterTemp,
    bottomType:  body.bottomType,
    lure:        body.lure,
    crocAlert:   body.crocAlert   ?? false,
    crocWarning: body.crocWarning ?? null,
    birdAlert:   body.birdAlert   ?? null,
    barraPct:    body.barraPct    ?? null,
    source:      body.source      ?? "live",
    updatedAt:   Date.now(),
  };
  broadcast(latest);
  res.json({ ok: true });
});

// ─── GET /hud/data ────────────────────────────────────────────────────────────
router.get("/hud/data", (_req, res) => {
  res.json(latest ?? { updatedAt: 0 });
});

// ─── GET /hud/events (SSE) ────────────────────────────────────────────────────
router.get("/hud/events", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (latest) res.write(`data: ${JSON.stringify(latest)}\n\n`);
  sseClients.add(res);

  req.on("close", () => sseClients.delete(res));
});

// ─── GET /hud — smart-glass HUD HTML page ─────────────────────────────────────
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
<title>HookVision HUD</title>
<style>
  :root {
    --navy:  #050d1c;
    --teal:  #00d4aa;
    --blue:  #00a8ff;
    --gold:  #ffd700;
    --red:   #ff4400;
    --orange:#ff8800;
    --dim:   rgba(255,255,255,0.45);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%; height: 100%;
    background: var(--navy);
    color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  body {
    display: flex;
    flex-direction: column;
    padding: 14px 18px;
    gap: 10px;
    user-select: none;
    -webkit-user-select: none;
  }

  /* ── Header bar ─────────────────────────────── */
  #header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  #brand {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 3px;
    color: var(--teal);
    text-transform: uppercase;
  }
  #status-dot {
    width: 9px; height: 9px; border-radius: 50%;
    background: #ffffff33;
    transition: background 0.4s;
  }
  #status-dot.live { background: var(--teal); box-shadow: 0 0 6px var(--teal); }
  #time { font-size: 12px; color: var(--dim); font-weight: 500; }

  /* ── Main species card ───────────────────────── */
  #species-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 4px;
    padding: 14px 16px;
    border: 1px solid #00d4aa33;
    border-radius: 14px;
    background: #00d4aa09;
    min-height: 0;
  }
  #species-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2.5px;
    color: var(--teal);
    text-transform: uppercase;
  }
  #species-name {
    font-size: 32px;
    font-weight: 900;
    color: #fff;
    line-height: 1.1;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  #confidence-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 2px;
  }
  #confidence-bar-wrap {
    flex: 1;
    height: 4px;
    background: #ffffff18;
    border-radius: 2px;
    overflow: hidden;
    max-width: 120px;
  }
  #confidence-bar {
    height: 100%;
    background: var(--teal);
    border-radius: 2px;
    transition: width 0.5s ease;
  }
  #confidence-val {
    font-size: 14px;
    font-weight: 800;
    color: var(--teal);
  }

  /* ── Metrics row ────────────────────────────── */
  #metrics {
    display: flex;
    gap: 8px;
  }
  .metric {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 10px 6px;
    border: 1px solid #ffffff14;
    border-radius: 10px;
    background: #ffffff07;
  }
  .metric-val {
    font-size: 22px;
    font-weight: 900;
    color: #fff;
    line-height: 1;
  }
  .metric-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: var(--dim);
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ── Suggestion strip ───────────────────────── */
  #suggestion {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.75);
    line-height: 1.45;
    padding: 10px 14px;
    border-left: 3px solid var(--teal);
    background: #00d4aa0c;
    border-radius: 0 10px 10px 0;
  }

  /* ── Alert pills ────────────────────────────── */
  #alerts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .alert-pill {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: 5px 10px;
    border-radius: 20px;
    border: 1.5px solid;
    animation: pulse 2s infinite;
  }
  .alert-pill.croc {
    color: var(--red);
    border-color: var(--red);
    background: #ff440015;
  }
  .alert-pill.bird {
    color: var(--teal);
    border-color: var(--teal);
    background: #00d4aa12;
  }
  .alert-pill.barra {
    color: var(--gold);
    border-color: var(--gold);
    background: #ffd70012;
  }

  /* ── Source badge ───────────────────────────── */
  #source-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: var(--dim);
    text-align: center;
    text-transform: uppercase;
  }

  /* ── Waiting screen ─────────────────────────── */
  #waiting {
    display: none;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }
  #waiting.show { display: flex; }
  .spinner {
    width: 36px; height: 36px;
    border: 3px solid #ffffff1a;
    border-top-color: var(--teal);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  #waiting-text { font-size: 14px; color: var(--dim); font-weight: 600; letter-spacing: 1px; }
  #waiting-sub  { font-size: 11px; color: #ffffff33; }

  #main { display: flex; flex-direction: column; flex: 1; gap: 10px; min-height: 0; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
</style>
</head>
<body>
  <!-- Header -->
  <div id="header">
    <div id="brand">HookVision HUD</div>
    <div style="display:flex;align-items:center;gap:8px">
      <div id="time">—</div>
      <div id="status-dot"></div>
    </div>
  </div>

  <!-- Waiting screen (shown when no data yet) -->
  <div id="waiting" class="show">
    <div class="spinner"></div>
    <div id="waiting-text">AWAITING SCAN</div>
    <div id="waiting-sub">Tap SCAN in HookVision to push results here</div>
  </div>

  <!-- Main HUD (hidden until first data) -->
  <div id="main" style="display:none">
    <!-- Species card -->
    <div id="species-card">
      <div id="species-label">Species Identified</div>
      <div id="species-name">—</div>
      <div id="confidence-row">
        <div id="confidence-bar-wrap"><div id="confidence-bar" style="width:0%"></div></div>
        <div id="confidence-val">0%</div>
      </div>
    </div>

    <!-- Metrics row: fish count / depth / arches -->
    <div id="metrics">
      <div class="metric">
        <div class="metric-val" id="fish-count">0</div>
        <div class="metric-label">Fish</div>
      </div>
      <div class="metric">
        <div class="metric-val" id="depth">—</div>
        <div class="metric-label">Depth</div>
      </div>
      <div class="metric">
        <div class="metric-val" id="arches">—</div>
        <div class="metric-label">Arches</div>
      </div>
      <div class="metric">
        <div class="metric-val" id="temp">—</div>
        <div class="metric-label">Temp</div>
      </div>
    </div>

    <!-- Suggestion strip -->
    <div id="suggestion">Awaiting scan…</div>

    <!-- Alerts (croc / birds / barra) -->
    <div id="alerts"></div>

    <!-- Source badge -->
    <div id="source-badge">—</div>
  </div>

<script>
  // ── Real-time update via SSE, poll as fallback ──────────────────────────────
  let lastUpdatedAt = 0;

  function applyData(d) {
    if (!d || !d.updatedAt || d.updatedAt === lastUpdatedAt) return;
    lastUpdatedAt = d.updatedAt;

    document.getElementById("waiting").classList.remove("show");
    document.getElementById("main").style.display = "flex";
    document.getElementById("status-dot").classList.add("live");

    document.getElementById("species-name").textContent = d.species || "—";
    const pct = Math.round((d.confidence || 0) * 100);
    document.getElementById("confidence-val").textContent = pct + "%";
    document.getElementById("confidence-bar").style.width = pct + "%";
    document.getElementById("fish-count").textContent = d.fishCount ?? "0";
    document.getElementById("depth").textContent = d.depth || "—";
    document.getElementById("arches").textContent = d.archCount != null ? d.archCount : "—";
    document.getElementById("temp").textContent = d.waterTemp || "—";
    document.getElementById("suggestion").textContent = d.suggestion || "";

    // Source badge
    const srcMap = { live:"📱 Live Camera", boat:"⚓ Boat Mode", cam2:"📺 Cam 2 Sonar" };
    document.getElementById("source-badge").textContent =
      (srcMap[d.source] || "📱 Live") + " · just now";

    // Alerts
    const alerts = document.getElementById("alerts");
    alerts.innerHTML = "";
    if (d.crocAlert) {
      const p = document.createElement("div");
      p.className = "alert-pill croc";
      p.textContent = "🐊 CROC ALERT" + (d.crocWarning ? " — " + d.crocWarning : "");
      alerts.appendChild(p);
    }
    if (d.birdAlert) {
      const p = document.createElement("div");
      p.className = "alert-pill bird";
      p.textContent = "🐦 " + d.birdAlert;
      alerts.appendChild(p);
    }
    if (d.barraPct != null && d.barraPct > 50) {
      const p = document.createElement("div");
      p.className = "alert-pill barra";
      p.textContent = "🎣 Barra " + d.barraPct + "% chance";
      alerts.appendChild(p);
    }
  }

  // Clock
  function tick() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2,"0");
    const m = now.getMinutes().toString().padStart(2,"0");
    const s = now.getSeconds().toString().padStart(2,"0");
    document.getElementById("time").textContent = h + ":" + m + ":" + s;
  }
  setInterval(tick, 1000); tick();

  // SSE
  function connectSSE() {
    const es = new EventSource("/api/hud/events");
    es.onmessage = (e) => { try { applyData(JSON.parse(e.data)); } catch {} };
    es.onerror   = () => { es.close(); setTimeout(connectSSE, 3000); };
  }
  connectSSE();

  // Poll fallback every 3s in case SSE is blocked
  setInterval(() => {
    fetch("/api/hud/data").then(r => r.json()).then(applyData).catch(() => {});
  }, 3000);
</script>
</body>
</html>`);
});

export default router;
