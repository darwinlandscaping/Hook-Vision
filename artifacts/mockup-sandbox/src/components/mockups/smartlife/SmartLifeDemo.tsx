import { useState, useEffect, useRef } from "react";

const C = {
  bg:   "#0a1628",
  card: "#0d1f3a",
  border:"#1a2f4a",
  teal: "#00d4aa",
  blue: "#00a8ff",
  gold: "#ffd700",
  red:  "#ff4400",
  sl:   "#00ffcc",
  mute: "rgba(255,255,255,0.27)",
  dim:  "rgba(255,255,255,0.67)",
};

// ─── PTZ button ──────────────────────────────────────────────────────────────
function PtzBtn({ icon, cmd, onCmd }: { icon: string; cmd: string; onCmd: (c: string) => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onMouseDown={() => { setPressed(true); onCmd(cmd); setTimeout(() => setPressed(false), 350); }}
      style={{
        width: 50, height: 50, borderRadius: 25,
        background: pressed ? C.sl + "44" : C.sl + "18",
        border: `2px solid ${pressed ? C.sl : C.sl + "44"}`,
        color: C.sl, fontSize: 22, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s", outline: "none",
      }}
    >
      {icon}
    </button>
  );
}

// ─── Simulated CCTV camera feed ───────────────────────────────────────────────
// Renders a convincing live-camera view using CSS + SVG — no external images.
function CctvFeed({ tick, ptzLog }: { tick: number; ptzLog: string | null }) {
  const phase = tick % 4;

  const scenes = [
    /* Scene 0 — mangrove estuary dawn */
    {
      sky:    "linear-gradient(180deg, #1a2a3a 0%, #2a3f55 40%, #3d5a6e 100%)",
      water:  "linear-gradient(180deg, #1e3a4a 0%, #0a2233 50%, #061520 100%)",
      label:  "ESTUARYMOUTH · MANGROVE",
      ripple: "#00a8ff33",
    },
    /* Scene 1 — open water midday */
    {
      sky:    "linear-gradient(180deg, #0d1f3a 0%, #1a3a5c 45%, #24547a 100%)",
      water:  "linear-gradient(180deg, #1a3a5c 0%, #0d2840 50%, #061929 100%)",
      label:  "RIVER MOUTH · OPEN WATER",
      ripple: "#00d4aa33",
    },
    /* Scene 2 — night IR mode */
    {
      sky:    "linear-gradient(180deg, #050e18 0%, #0a1a22 100%)",
      water:  "linear-gradient(180deg, #0a1a22 0%, #050e18 100%)",
      label:  "IR NIGHT MODE · BILLABONG",
      ripple: "#00ff4433",
    },
    /* Scene 3 — sunset creek */
    {
      sky:    "linear-gradient(180deg, #3a1a0a 0%, #6b3520 40%, #4a2a10 100%)",
      water:  "linear-gradient(180deg, #2a1a0a 0%, #1a0d05 50%, #0a0803 100%)",
      label:  "TIDAL CREEK · GOLDEN HOUR",
      ripple: "#ffd70033",
    },
  ];

  const s = scenes[phase];
  const isNight = phase === 2;

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 10, overflow: "hidden", background: "#000" }}>

      {/* Sky */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "48%", background: s.sky }} />

      {/* Horizon glow */}
      <div style={{ position: "absolute", top: "44%", left: 0, right: 0, height: 6,
        background: isNight ? "rgba(0,255,100,0.08)" : "rgba(255,200,100,0.12)",
        filter: "blur(4px)" }} />

      {/* Water body */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%", background: s.water }} />

      {/* Water ripples — SVG wave lines */}
      <svg style={{ position: "absolute", bottom: "10%", left: 0, width: "100%", height: "30%", opacity: 0.4 }}
           viewBox="0 0 400 80" preserveAspectRatio="none">
        {[0,1,2,3].map(i => (
          <path key={i}
            d={`M${-40 + (tick * 8 + i * 30) % 60},${20 + i*15} Q${60 + i*20},${10 + i*12} ${140 + i*30},${20+i*15} Q${220+i*10},${30+i*15} ${300+i*20},${20+i*15} Q${380+i*15},${12+i*12} ${440+i*20},${20+i*15}`}
            fill="none" stroke={s.ripple} strokeWidth="1.5"
            style={{ animation: `ripple${i} ${2.5 + i * 0.4}s ease-in-out infinite alternate` }}
          />
        ))}
      </svg>

      {/* Fish school dots */}
      <div style={{ position: "absolute", bottom: "20%", left: `${30 + (tick * 7) % 40}%`,
        display: "flex", gap: 3, opacity: 0.6 }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{ width: 4 + (i % 3), height: 3, borderRadius: "50%",
            background: isNight ? "#00ff88" : "#ffd700aa",
            transform: `translateY(${Math.sin(tick + i) * 3}px)` }} />
        ))}
      </div>

      {/* Vegetation silhouette (mangroves/reeds) */}
      <svg style={{ position: "absolute", bottom: "44%", left: 0, width: "100%", height: "22%", opacity: 0.7 }}
           viewBox="0 0 400 60" preserveAspectRatio="none">
        <path d="M0,60 L0,35 Q10,20 20,35 Q25,10 35,30 Q40,5 50,28 Q55,15 65,32 Q70,8 80,30 L80,60Z"
          fill={isNight ? "#030a10" : "#0d1f2a"} />
        <path d="M320,60 L320,38 Q330,18 340,35 Q348,10 358,32 Q365,20 375,35 Q382,8 390,28 Q395,18 400,30 L400,60Z"
          fill={isNight ? "#030a10" : "#0d1f2a"} />
      </svg>

      {/* Scan lines overlay */}
      <div style={{ position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
        pointerEvents: "none" }} />

      {/* Night IR green tint */}
      {isNight && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,80,40,0.18)", mixBlendMode: "screen", pointerEvents: "none" }} />
      )}

      {/* PTZ command overlay */}
      {ptzLog && (
        <div style={{
          position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.8)", borderRadius: 8, padding: "5px 14px",
          color: C.sl, fontWeight: 800, fontSize: 13, fontFamily: "monospace",
          border: `1px solid ${C.sl}66`,
        }}>
          {ptzLog}
        </div>
      )}

      {/* Top-left: CAM label */}
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 7px",
          color: isNight ? "#00ff88" : C.sl, fontSize: 10, fontWeight: 700, fontFamily: "monospace" }}>
          {isNight ? "●IR " : "●"}CAM1
        </div>
        <div style={{ background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 7px",
          color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "monospace" }}>
          {s.label}
        </div>
      </div>

      {/* Bottom row: endpoint + time */}
      <div style={{ position: "absolute", bottom: 8, left: 8, right: 8,
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 7px",
          color: C.sl, fontSize: 10, fontWeight: 700, fontFamily: "monospace" }}>
          192.168.4.1/snapshot.cgi?_t={tick}
        </div>
        <div style={{ background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 7px",
          color: C.gold, fontSize: 10, fontWeight: 700, fontFamily: "monospace" }}>
          {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

// ─── Main demo component ──────────────────────────────────────────────────────
export default function SmartLifeDemo() {
  const [tick,    setTick]    = useState(0);
  const [snapped, setSnapped] = useState(false);
  const [ptzLog,  setPtzLog]  = useState<string | null>(null);
  const ptzTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2500);
    return () => clearInterval(t);
  }, []);

  const handlePTZ = (cmd: string) => {
    setPtzLog(`PTZ → ${cmd.toUpperCase()}`);
    if (ptzTimeout.current) clearTimeout(ptzTimeout.current);
    ptzTimeout.current = setTimeout(() => setPtzLog(null), 1300);
  };

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: C.bg, fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      padding: 16, boxSizing: "border-box",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: C.sl + "22",
            border: `1.5px solid ${C.sl}55`, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18 }}>📡</div>
          <div>
            <div style={{ color: C.sl, fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>SMARTLIFE LIVE VIEW</div>
            <div style={{ color: C.mute, fontSize: 11 }}>192.168.4.1 · Tuya/SmartLife PTZ Camera</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5,
          background: C.red + "22", border: `1px solid ${C.red}55`,
          borderRadius: 6, padding: "4px 10px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.red,
            animation: "pulse 1s infinite" }} />
          <span style={{ color: C.red, fontWeight: 800, fontSize: 11 }}>LIVE</span>
        </div>
      </div>

      {/* ── Connected banner ─────────────────────────────────────────────────── */}
      <div style={{
        background: C.teal + "15", border: `1px solid ${C.teal}44`,
        borderRadius: 10, padding: "9px 12px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ color: C.teal, fontSize: 16 }}>✓</div>
        <div>
          <div style={{ color: C.teal, fontWeight: 800, fontSize: 12 }}>
            CONNECTED — SmartLife Outdoor PTZ Cam
          </div>
          <div style={{ color: C.mute, fontSize: 10, marginTop: 2 }}>
            192.168.4.1 · 23ms · /snapshot.cgi · auto-discovered in 4s
          </div>
        </div>
      </div>

      {/* ── Live stream ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 14, border: `1.5px solid ${C.sl}44`, borderRadius: 12, overflow: "hidden" }}>
        <CctvFeed tick={tick} ptzLog={ptzLog} />
      </div>

      {/* ── Controls: PTZ (left) + Buttons (right) ────────────────────────── */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>

        {/* PTZ pad */}
        <div style={{ background: C.card, borderRadius: 14, padding: 12, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.mute, fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
            textAlign: "center", marginBottom: 8 }}>PTZ CONTROL</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <PtzBtn icon="↑" cmd="up"    onCmd={handlePTZ} />
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <PtzBtn icon="←" cmd="left"  onCmd={handlePTZ} />
              <button onClick={() => handlePTZ("stop")} style={{
                width: 50, height: 50, borderRadius: 25,
                background: C.red + "22", border: `2px solid ${C.red}66`,
                color: C.red, fontSize: 16, cursor: "pointer", outline: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>■</button>
              <PtzBtn icon="→" cmd="right" onCmd={handlePTZ} />
            </div>
            <PtzBtn icon="↓" cmd="down"  onCmd={handlePTZ} />
            <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
              <button onClick={() => handlePTZ("zoomin")} style={{
                flex: 1, height: 30, borderRadius: 6,
                background: C.sl + "18", border: `1.5px solid ${C.sl}44`,
                color: C.sl, cursor: "pointer", fontWeight: 800, fontSize: 13, outline: "none",
              }}>Z +</button>
              <button onClick={() => handlePTZ("zoomout")} style={{
                flex: 1, height: 30, borderRadius: 6,
                background: C.sl + "18", border: `1.5px solid ${C.sl}44`,
                color: C.sl, cursor: "pointer", fontWeight: 800, fontSize: 13, outline: "none",
              }}>Z −</button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingTop: 30 }}>
          <button onClick={() => setSnapped(true)} style={{
            height: 44, borderRadius: 10, background: C.teal + "22",
            border: `1.5px solid ${C.teal}88`, color: C.teal,
            fontWeight: 800, fontSize: 13, cursor: "pointer", outline: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>📸 SNAPSHOT</button>

          <button style={{
            height: 44, borderRadius: 10, background: C.sl + "18",
            border: `1.5px solid ${C.sl}44`, color: C.sl,
            fontWeight: 800, fontSize: 13, cursor: "pointer", outline: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>🌐 WEB UI</button>

          {/* Endpoint chip */}
          <div style={{ background: C.border, borderRadius: 6, padding: "6px 10px" }}>
            <div style={{ color: C.mute, fontSize: 10, fontFamily: "monospace", marginBottom: 2 }}>
              Current endpoint
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "monospace" }}>
              192.168.4.1/snapshot.cgi
            </div>
          </div>

          {/* Live status */}
          <div style={{ background: C.sl + "18", borderRadius: 8, padding: "7px 10px",
            border: `1px solid ${C.sl}33`, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.sl,
              animation: "pulse 1.5s infinite" }} />
            <div style={{ color: C.sl, fontSize: 11, fontWeight: 700 }}>
              Connected · 23ms · frame #{tick}
            </div>
          </div>
        </div>
      </div>

      {/* ── Snapshot capture result ──────────────────────────────────────────── */}
      {snapped && (
        <div style={{ background: C.card, borderRadius: 12, padding: 12,
          border: `1px solid ${C.border}`, marginTop: 4 }}>
          <div style={{ color: C.mute, fontSize: 10, fontWeight: 700,
            letterSpacing: 0.8, marginBottom: 8 }}>LAST SNAPSHOT · AI BRAIN ANALYSIS READY</div>
          <CctvFeed tick={tick} ptzLog={null} />
          <div style={{ marginTop: 8, background: C.teal + "15", borderRadius: 8, padding: "8px 10px",
            border: `1px solid ${C.teal}33` }}>
            <div style={{ color: C.teal, fontWeight: 800, fontSize: 12 }}>
              🧠 Ready — tap Analyse Frame to run GPT-4.1 brain scan
            </div>
            <div style={{ color: C.mute, fontSize: 10, marginTop: 3 }}>
              Detects fish busts · croc risk · cast zone · bait balls · bird activity
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes ripple0 { from { transform: translateX(0px); } to { transform: translateX(-15px); } }
        @keyframes ripple1 { from { transform: translateX(0px); } to { transform: translateX(12px); } }
        @keyframes ripple2 { from { transform: translateX(0px); } to { transform: translateX(-10px); } }
        @keyframes ripple3 { from { transform: translateX(0px); } to { transform: translateX(18px); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
