import { useState, useEffect, useRef } from "react";

const C = {
  bg:    "#0a1628",
  card:  "#0d1f3a",
  border:"#1a2f4a",
  teal:  "#00d4aa",
  blue:  "#00a8ff",
  gold:  "#ffd700",
  red:   "#ff4400",
  sl:    "#00ffcc",
  mute:  "rgba(255,255,255,0.27)",
  dim:   "rgba(255,255,255,0.67)",
  green: "#00ff88",
  orange:"#ff9900",
};

// ─── PTZ button ───────────────────────────────────────────────────────────────
function PtzBtn({ icon, cmd, onCmd }: { icon: string; cmd: string; onCmd: (c: string) => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onMouseDown={() => { setPressed(true); onCmd(cmd); setTimeout(() => setPressed(false), 300); }}
      style={{
        width: 38, height: 38, borderRadius: 19,
        background: pressed ? C.sl + "44" : C.sl + "18",
        border: `1.5px solid ${pressed ? C.sl : C.sl + "55"}`,
        color: C.sl, fontSize: 16, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s", outline: "none",
      }}
    >{icon}</button>
  );
}

// ─── CAM 1: SmartLife water/estuary feed ──────────────────────────────────────
function Cam1Feed({ tick, ptzLog }: { tick: number; ptzLog: string | null }) {
  const scene = tick % 4;
  const scenes = [
    { sky: "linear-gradient(180deg,#1a2a3a 0%,#2a3f55 40%,#3d5a6e 100%)", water: "linear-gradient(180deg,#1e3a4a 0%,#0a2233 50%,#061520 100%)", label: "ESTUARY · MANGROVE", night: false },
    { sky: "linear-gradient(180deg,#0d1f3a 0%,#1a3a5c 45%,#24547a 100%)", water: "linear-gradient(180deg,#1a3a5c 0%,#0d2840 50%,#061929 100%)", label: "RIVER MOUTH · OPEN", night: false },
    { sky: "linear-gradient(180deg,#050e18 0%,#0a1a22 100%)",             water: "linear-gradient(180deg,#0a1a22 0%,#050e18 100%)",             label: "IR NIGHT · BILLABONG", night: true },
    { sky: "linear-gradient(180deg,#3a1a0a 0%,#6b3520 40%,#4a2a10 100%)", water: "linear-gradient(180deg,#2a1a0a 0%,#1a0d05 50%,#0a0803 100%)", label: "TIDAL CREEK · SUNSET", night: false },
  ];
  const s = scenes[scene];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "48%", background: s.sky }} />
      <div style={{ position: "absolute", top: "44%", left: 0, right: 0, height: 5, background: s.night ? "rgba(0,255,100,0.07)" : "rgba(255,200,100,0.10)", filter: "blur(3px)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%", background: s.water }} />
      {/* ripples */}
      <svg style={{ position: "absolute", bottom: "10%", left: 0, width: "100%", height: "28%", opacity: 0.35 }} viewBox="0 0 300 60" preserveAspectRatio="none">
        {[0,1,2].map(i => (
          <path key={i} d={`M${-30+(tick*5+i*25)%50},${18+i*14} Q${60+i*20},${8+i*10} ${140+i*25},${18+i*14} Q${220+i*10},${28+i*14} ${310+i*15},${18+i*14}`}
            fill="none" stroke={s.night ? "#00ff4433" : "#00d4aa33"} strokeWidth="1.2"
            style={{ animation: `ripple${i} ${2.5+i*0.4}s ease-in-out infinite alternate` }} />
        ))}
      </svg>
      {/* fish dots */}
      <div style={{ position: "absolute", bottom: "22%", left: `${28+(tick*6)%38}%`, display: "flex", gap: 2, opacity: 0.65 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ width: 3+(i%2), height: 2, borderRadius: "50%", background: s.night ? C.green : C.gold, transform: `translateY(${Math.sin(tick+i)*2}px)` }} />)}
      </div>
      {/* mangrove silhouette */}
      <svg style={{ position: "absolute", bottom: "44%", left: 0, width: "100%", height: "20%", opacity: 0.65 }} viewBox="0 0 300 50" preserveAspectRatio="none">
        <path d="M0,50 L0,28 Q8,14 18,28 Q22,6 32,25 Q38,10 48,26 L48,50Z" fill={s.night?"#030a10":"#0d1f2a"} />
        <path d="M252,50 L252,30 Q260,14 268,28 Q274,8 284,26 Q290,15 300,27 L300,50Z" fill={s.night?"#030a10":"#0d1f2a"} />
      </svg>
      {/* scan lines */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.12) 2px,rgba(0,0,0,0.12) 4px)", pointerEvents: "none" }} />
      {s.night && <div style={{ position: "absolute", inset: 0, background: "rgba(0,70,35,0.16)", pointerEvents: "none" }} />}
      {/* PTZ overlay */}
      {ptzLog && (
        <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.85)", borderRadius: 6, padding: "3px 10px", color: C.sl, fontWeight: 800, fontSize: 11, fontFamily: "monospace", border: `1px solid ${C.sl}66` }}>{ptzLog}</div>
      )}
      {/* overlays */}
      <div style={{ position: "absolute", top: 6, left: 6, display: "flex", gap: 4 }}>
        <div style={{ background: "rgba(0,0,0,0.75)", borderRadius: 3, padding: "2px 5px", color: s.night ? C.green : C.sl, fontSize: 9, fontWeight: 700, fontFamily: "monospace" }}>{s.night?"●IR ":"●"}CAM1</div>
        <div style={{ background: "rgba(0,0,0,0.75)", borderRadius: 3, padding: "2px 5px", color: "rgba(255,255,255,0.55)", fontSize: 9, fontFamily: "monospace" }}>{s.label}</div>
      </div>
      <div style={{ position: "absolute", bottom: 5, left: 5, right: 5, display: "flex", justifyContent: "space-between" }}>
        <div style={{ background: "rgba(0,0,0,0.7)", borderRadius: 3, padding: "1px 5px", color: C.sl, fontSize: 9, fontWeight: 700, fontFamily: "monospace" }}>192.168.4.1/snapshot.cgi?t={tick}</div>
        <div style={{ background: "rgba(0,0,0,0.7)", borderRadius: 3, padding: "1px 5px", color: C.gold, fontSize: 9, fontFamily: "monospace" }}>{new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

// ─── CAM 2: Sonar screen feed ─────────────────────────────────────────────────
function SonarFeed({ tick }: { tick: number }) {
  // Simulate sonar echo data — fish arches at varying depths
  const depth = 8.4 + Math.sin(tick * 0.3) * 0.6;
  const fishArches = [
    { y: 0.38 + Math.sin(tick * 0.15) * 0.04, x: 0.3 + Math.cos(tick * 0.1) * 0.05, strength: "strong" },
    { y: 0.55 + Math.sin(tick * 0.2 + 1) * 0.03, x: 0.6 + Math.sin(tick * 0.12) * 0.06, strength: "medium" },
    { y: 0.72 + Math.cos(tick * 0.18) * 0.03, x: 0.45, strength: "weak" },
  ];
  const strengthColor = (s: string) => s === "strong" ? "#ff6600" : s === "medium" ? "#ffcc00" : "#00cc44";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000", overflow: "hidden", fontFamily: "monospace" }}>

      {/* Sonar waterfall background — vertical stripes simulating time scroll */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#000 0%,#021008 20%,#031510 40%,#021008 60%,#000 100%)" }} />

      {/* Depth bands (green → yellow → orange → red with depth) */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,40,20,0.3) 0%,rgba(0,80,30,0.4) 30%,rgba(30,80,0,0.5) 55%,rgba(80,60,0,0.6) 72%,rgba(100,40,0,0.7) 85%,rgba(60,20,0,0.8) 100%)" }} />

      {/* Bottom contour fill */}
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "28%" }} viewBox="0 0 300 60" preserveAspectRatio="none">
        <path d={`M0,60 L0,${25+Math.sin(tick*0.2)*4} Q40,${20+Math.cos(tick*0.15)*3} 80,${28+Math.sin(tick*0.25)*5} Q120,${22+Math.cos(tick*0.18)*3} 160,${30+Math.sin(tick*0.12)*4} Q200,${24+Math.cos(tick*0.22)*3} 240,${28+Math.sin(tick*0.16)*4} Q270,${22+Math.cos(tick*0.2)*2} 300,${26+Math.sin(tick*0.14)*3} L300,60Z`}
          fill="#8B4513" opacity="0.9" />
        <path d={`M0,60 L0,${32+Math.sin(tick*0.2)*4} Q40,${28+Math.cos(tick*0.15)*2} 80,${35+Math.sin(tick*0.25)*3} Q120,${30+Math.cos(tick*0.18)*2} 160,${38+Math.sin(tick*0.12)*3} Q200,${32+Math.cos(tick*0.22)*2} 240,${36+Math.sin(tick*0.16)*3} Q270,${30+Math.cos(tick*0.2)*1} 300,${34+Math.sin(tick*0.14)*2} L300,60Z`}
          fill="#5a2d00" opacity="0.95" />
      </svg>

      {/* Fish arches */}
      {fishArches.map((f, i) => (
        <svg key={i} style={{ position: "absolute", left: `${(f.x*100)-8}%`, top: `${(f.y*100)-3}%`, width: "16%", height: "8%" }} viewBox="0 0 40 14" preserveAspectRatio="none">
          <path d={`M2,12 Q10,${2+i} 20,4 Q30,${2+i} 38,12`} fill="none" stroke={strengthColor(f.strength)} strokeWidth={f.strength==="strong"?2.5:f.strength==="medium"?1.8:1.2} opacity="0.9" />
        </svg>
      ))}

      {/* Surface interference line */}
      <div style={{ position: "absolute", top: "4%", left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,#00ff8888,#00ff88,#00ff8888,transparent)", filter: "blur(1px)" }} />

      {/* Scan lines */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.18) 3px,rgba(0,0,0,0.18) 5px)", pointerEvents: "none" }} />

      {/* Depth ruler (right side) */}
      <div style={{ position: "absolute", right: 4, top: "8%", bottom: "5%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {[0, 2, 4, 6, 8, 10].map(d => (
          <div key={d} style={{ color: "rgba(255,255,255,0.55)", fontSize: 8, fontFamily: "monospace", textAlign: "right" }}>{d}m</div>
        ))}
      </div>

      {/* CAM2 label */}
      <div style={{ position: "absolute", top: 5, left: 5, display: "flex", gap: 4 }}>
        <div style={{ background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "2px 5px", color: C.blue, fontSize: 9, fontWeight: 700, fontFamily: "monospace" }}>●CAM2</div>
        <div style={{ background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "2px 5px", color: "rgba(255,255,255,0.55)", fontSize: 9, fontFamily: "monospace" }}>SONAR DISPLAY</div>
      </div>

      {/* Bottom stats */}
      <div style={{ position: "absolute", bottom: 5, left: 5, right: 14, display: "flex", justifyContent: "space-between" }}>
        <div style={{ background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "1px 5px", color: C.blue, fontSize: 9, fontFamily: "monospace" }}>DEPTH {depth.toFixed(1)}m</div>
        <div style={{ background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "1px 5px", color: C.green, fontSize: 9, fontFamily: "monospace" }}>FREQ 200kHz</div>
        <div style={{ background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "1px 5px", color: C.gold, fontSize: 9, fontFamily: "monospace" }}>{new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

// ─── Pipeline status chip ─────────────────────────────────────────────────────
function PipelineChip({ label, color, fps, ok }: { label: string; color: string; fps: number; ok: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: color + "14", borderRadius: 7, padding: "5px 9px", border: `1px solid ${color}44`, flex: 1 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: ok ? color : C.red, animation: "pulse 1.2s infinite" }} />
      <div style={{ flex: 1 }}>
        <div style={{ color, fontWeight: 800, fontSize: 10 }}>{label}</div>
        <div style={{ color: C.mute, fontSize: 9 }}>{fps} fps · live</div>
      </div>
    </div>
  );
}

// ─── Analyser result row ──────────────────────────────────────────────────────
function AnalyserRow({ icon, label, value, color, source }: { icon: string; label: string; value: string; color: string; source: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.dim, fontSize: 11, fontWeight: 700 }}>{label}</div>
        <div style={{ color: C.mute, fontSize: 9 }}>from {source}</div>
      </div>
      <div style={{ color, fontWeight: 800, fontSize: 11, textAlign: "right" }}>{value}</div>
    </div>
  );
}

// ─── Main demo component ──────────────────────────────────────────────────────
export default function SmartLifeDemo() {
  const [tick,   setTick]   = useState(0);
  const [ptzLog, setPtzLog] = useState<string | null>(null);
  const ptzTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const handlePTZ = (cmd: string) => {
    setPtzLog(`PTZ → ${cmd.toUpperCase()}`);
    if (ptzTimeout.current) clearTimeout(ptzTimeout.current);
    ptzTimeout.current = setTimeout(() => setPtzLog(null), 1200);
  };

  // Derived analyser data that shifts with tick
  const fishCount   = 2 + (tick % 3);
  const depthM      = (8.4 + Math.sin(tick * 0.3) * 0.6).toFixed(1);
  const archStrength = ["STRONG", "MODERATE", "FAINT"][tick % 3];
  const archColor    = [C.red, C.gold, C.green][tick % 3];
  const croc         = tick % 7 < 2 ? "⚠ POSSIBLE — 8m NE" : "CLEAR";
  const crocColor    = tick % 7 < 2 ? C.red : C.green;
  const castZone     = ["CAST LEFT 30°", "CAST CENTRE", "CAST RIGHT 25°"][tick % 3];

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: C.bg, fontFamily: "'SF Pro Display',-apple-system,sans-serif", padding: 12, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: C.sl+"22", border:`1.5px solid ${C.sl}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>📡</div>
          <div>
            <div style={{ color: C.sl, fontWeight: 800, fontSize: 13, letterSpacing: 0.4 }}>DUAL-CAM FEED → AI ANALYSER</div>
            <div style={{ color: C.mute, fontSize: 10 }}>SmartLife PTZ + Sonar Monitor · 2 pipelines</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, background:C.red+"22", border:`1px solid ${C.red}55`, borderRadius:6, padding:"3px 8px" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:C.red, animation:"pulse 1s infinite" }} />
          <span style={{ color:C.red, fontWeight:800, fontSize:10 }}>LIVE</span>
        </div>
      </div>

      {/* ── Pipeline status bars ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8 }}>
        <PipelineChip label="CAM1 · SmartLife PTZ" color={C.sl}  fps={6}  ok={true} />
        <PipelineChip label="CAM2 · Sonar Screen"  color={C.blue} fps={4} ok={true} />
      </div>

      {/* ── Split-screen cameras ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, height: 200, borderRadius: 10, overflow: "hidden", border:`1.5px solid ${C.border}` }}>
        {/* CAM1 left half */}
        <div style={{ flex: 1, position: "relative" }}>
          <Cam1Feed tick={tick} ptzLog={ptzLog} />
        </div>
        {/* Divider */}
        <div style={{ width: 2, background: C.border, flexShrink: 0 }} />
        {/* CAM2 right half */}
        <div style={{ flex: 1, position: "relative" }}>
          <SonarFeed tick={tick} />
        </div>
      </div>

      {/* ── Controls row: PTZ (left) + data chips (right) ──────────────────── */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        {/* PTZ mini pad */}
        <div style={{ background: C.card, borderRadius: 10, padding: "8px 10px", border:`1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ color: C.mute, fontSize: 9, fontWeight: 700, textAlign: "center", marginBottom: 5, letterSpacing: 0.8 }}>PTZ · CAM1</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <PtzBtn icon="↑" cmd="up"    onCmd={handlePTZ} />
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <PtzBtn icon="←" cmd="left"  onCmd={handlePTZ} />
              <button onClick={() => handlePTZ("stop")} style={{ width: 38, height: 38, borderRadius: 19, background: C.red+"22", border:`1.5px solid ${C.red}66`, color: C.red, fontSize: 14, cursor:"pointer", outline:"none", display:"flex", alignItems:"center", justifyContent:"center" }}>■</button>
              <PtzBtn icon="→" cmd="right" onCmd={handlePTZ} />
            </div>
            <PtzBtn icon="↓" cmd="down"  onCmd={handlePTZ} />
            <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
              <button onClick={() => handlePTZ("zoomin")}  style={{ width: 42, height: 24, borderRadius: 5, background: C.sl+"18", border:`1px solid ${C.sl}44`, color: C.sl, cursor:"pointer", fontWeight: 800, fontSize: 11, outline:"none" }}>Z+</button>
              <button onClick={() => handlePTZ("zoomout")} style={{ width: 42, height: 24, borderRadius: 5, background: C.sl+"18", border:`1px solid ${C.sl}44`, color: C.sl, cursor:"pointer", fontWeight: 800, fontSize: 11, outline:"none" }}>Z−</button>
            </div>
          </div>
        </div>

        {/* CAM2 sonar quick stats */}
        <div style={{ flex: 1, background: C.card, borderRadius: 10, padding: "10px 12px", border:`1px solid ${C.border}` }}>
          <div style={{ color: C.mute, fontSize: 9, fontWeight: 700, letterSpacing: 0.8, marginBottom: 7 }}>CAM2 · SONAR READINGS</div>
          {[
            { label: "Water Depth", value: `${depthM}m`, color: C.blue },
            { label: "Fish Arches", value: `${fishCount} detected`, color: C.green },
            { label: "Echo Strength", value: archStrength, color: archColor },
            { label: "Freq / Range", value: "200kHz / 12m", color: C.mute },
          ].map(r => (
            <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ color: C.mute, fontSize: 10 }}>{r.label}</span>
              <span style={{ color: r.color, fontWeight: 800, fontSize: 10 }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Dual-Pipeline Analyser ───────────────────────────────────────── */}
      <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px", border:`1.5px solid ${C.teal}44` }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 10 }}>
          <div style={{ display:"flex", alignItems:"center", gap: 7 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <div>
              <div style={{ color: C.teal, fontWeight: 800, fontSize: 12 }}>AI BRAIN ANALYSER</div>
              <div style={{ color: C.mute, fontSize: 9 }}>GPT-4.1 Vision · fusing CAM1 + CAM2 · frame #{tick}</div>
            </div>
          </div>
          <div style={{ display:"flex", gap: 4 }}>
            <div style={{ background: C.sl+"22", borderRadius: 4, padding:"2px 6px", color: C.sl, fontSize: 9, fontWeight: 800 }}>CAM1</div>
            <span style={{ color: C.mute, fontSize: 9, lineHeight:"20px" }}>+</span>
            <div style={{ background: C.blue+"22", borderRadius: 4, padding:"2px 6px", color: C.blue, fontSize: 9, fontWeight: 800 }}>CAM2</div>
          </div>
        </div>

        {/* Pipeline flow diagram */}
        <div style={{ display:"flex", gap: 4, alignItems:"center", marginBottom: 10, padding:"6px 8px", background:"#0a1628", borderRadius: 8, border:`1px solid ${C.border}` }}>
          <div style={{ background: C.sl+"22", borderRadius: 5, padding:"3px 7px", color: C.sl, fontSize: 9, fontWeight: 800 }}>CAM1<br/>Water</div>
          <div style={{ color: C.mute, fontSize: 10 }}>→</div>
          <div style={{ background: C.border, borderRadius: 5, padding:"3px 7px", color: C.dim, fontSize: 9 }}>Vision<br/>Model</div>
          <div style={{ color: C.mute, fontSize: 10 }}>↘</div>
          <div style={{ flex: 1, background: C.teal+"22", border:`1px solid ${C.teal}44`, borderRadius: 6, padding:"5px 8px", textAlign:"center" }}>
            <div style={{ color: C.teal, fontWeight: 800, fontSize: 10 }}>FUSION LAYER</div>
            <div style={{ color: C.mute, fontSize: 8 }}>GPT-4.1 · cross-stream</div>
          </div>
          <div style={{ color: C.mute, fontSize: 10 }}>→</div>
          <div style={{ background: C.gold+"22", borderRadius: 5, padding:"3px 7px", color: C.gold, fontSize: 9, fontWeight: 800 }}>RESULT<br/>Intel</div>
          <div style={{ color: C.mute, fontSize: 10 }}>↗</div>
          <div style={{ background: C.border, borderRadius: 5, padding:"3px 7px", color: C.dim, fontSize: 9 }}>Sonar<br/>OCR</div>
          <div style={{ color: C.mute, fontSize: 10 }}>←</div>
          <div style={{ background: C.blue+"22", borderRadius: 5, padding:"3px 7px", color: C.blue, fontSize: 9, fontWeight: 800 }}>CAM2<br/>Sonar</div>
        </div>

        {/* Analysis results */}
        <AnalyserRow icon="🐟" label="Fish Presence"  value={`${fishCount} school(s) · ${archStrength}`} color={archColor}    source="CAM2 sonar + CAM1 surface bust" />
        <AnalyserRow icon="⚠️" label="Croc Risk"      value={croc}                                        color={crocColor}    source="CAM1 vision · thermal edge detect" />
        <AnalyserRow icon="🎣" label="Best Cast Zone" value={castZone}                                    color={C.gold}       source="Fusion: sonar arch → surface feed" />
        <AnalyserRow icon="📏" label="Water Depth"    value={`${depthM}m · soft bottom`}                 color={C.blue}       source="CAM2 sonar depth scale OCR" />
        <AnalyserRow icon="🌊" label="Water Clarity"  value={tick%4<2?"TANNIN/MURKY":"CLEAR"}             color={tick%4<2?C.orange:C.teal} source="CAM1 vision · colour analysis" />

        {/* Action buttons */}
        <div style={{ display:"flex", gap: 8, marginTop: 10 }}>
          <button style={{ flex:1, height: 36, borderRadius: 8, background: C.teal+"22", border:`1.5px solid ${C.teal}88`, color: C.teal, fontWeight:800, fontSize:11, cursor:"pointer", outline:"none" }}>📸 SNAPSHOT BOTH</button>
          <button style={{ flex:1, height: 36, borderRadius: 8, background: C.gold+"22", border:`1.5px solid ${C.gold}88`, color: C.gold, fontWeight:800, fontSize:11, cursor:"pointer", outline:"none" }}>🧠 DEEP SCAN</button>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes ripple0 { from{transform:translateX(0)} to{transform:translateX(-12px)} }
        @keyframes ripple1 { from{transform:translateX(0)} to{transform:translateX(10px)} }
        @keyframes ripple2 { from{transform:translateX(0)} to{transform:translateX(-8px)} }
        * { box-sizing:border-box; }
      `}</style>
    </div>
  );
}
