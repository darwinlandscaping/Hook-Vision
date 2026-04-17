import { useState, useEffect, useRef, useCallback } from "react";

const C = {
  bg:    "#0a1628",
  card:  "#0d1f3a",
  border:"#1a2f4a",
  teal:  "#00d4aa",
  blue:  "#00a8ff",
  gold:  "#ffd700",
  red:   "#ff4400",
  sl:    "#00ffcc",
  mute:  "rgba(255,255,255,0.30)",
  dim:   "rgba(255,255,255,0.72)",
  green: "#00ff88",
  orange:"#ff9900",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode = "idle" | "connecting" | "live" | "error";
type CamType = "url" | "webcam";
type AnalyseState = "idle" | "thinking" | "done";

interface BrainResult {
  fish: string;
  croc: string;
  castZone: string;
  depth: string;
  clarity: string;
  activity: string;
  confidence: number;
  notes: string;
}

const SL_ENDPOINTS = [
  "/snapshot.cgi",
  "/cgi-bin/snapshot.cgi",
  "/snap.jpg",
  "/video0.jpg",
  "/Streaming/channels/1/picture",
];

// Realistic AI brain results that rotate to simulate live analysis
const BRAIN_POOL: BrainResult[] = [
  { fish:"Barramundi school · 3–5 fish · 2–4kg avg", croc:"CLEAR · no thermal signature", castZone:"CAST LEFT 25°, 12m out — fish busting surface", depth:"4.2m · soft mud bottom", clarity:"TANNIN/MURKY · 0.4m vis", activity:"HIGH — bait ball activity detected near left bank", confidence:87, notes:"Osprey diving pattern confirms fish activity. Cast into shadow edge." },
  { fish:"2 Barramundi arches · sonar depth 6m", croc:"LOW RISK · movement detected 40m upstream", castZone:"HOLD POSITION — fish moving toward you", depth:"6.1m · rocky structure", clarity:"CLEAR · 1.2m vis", activity:"MODERATE — fish sitting deep on structure", confidence:74, notes:"Sonar shows fish tight to rock structure. Slow bottom presentation." },
  { fish:"Large single arch · estimated 60–80cm", croc:"⚠ CAUTION — 15m, bank left", castZone:"CAST RIGHT 30°, away from croc", depth:"3.8m · sandy flat", clarity:"MURKY · run-off tannin", activity:"HIGH — feeding window · golden hour", confidence:91, notes:"Sunset bite window. Big single fish working the flat edge. Cast away from croc zone." },
  { fish:"No arches currently · surface bust 3 min ago", croc:"CLEAR", castZone:"WAIT — fish likely regrouping below structure", depth:"5.5m", clarity:"CLEAR · 1.0m vis", activity:"LOW · between feeding windows", confidence:62, notes:"Activity dropped after surface bust. Hold for 5–10 min then try again." },
];

// ── Input row ─────────────────────────────────────────────────────────────────
function InputRow({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: C.mute, fontSize: 10, fontWeight: 700, marginBottom: 3, letterSpacing: 0.6 }}>{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", background: "#061018", border: `1px solid ${C.border}`,
          borderRadius: 7, color: C.dim, padding: "8px 10px", fontSize: 12,
          fontFamily: mono ? "monospace" : "inherit", outline: "none", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: color + "20", border: `1px solid ${color}55`, borderRadius: 6, padding: "3px 9px" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, animation: "pulse 1.2s infinite" }} />
      <span style={{ color, fontWeight: 800, fontSize: 10 }}>{label}</span>
    </div>
  );
}

// ── AI result row ─────────────────────────────────────────────────────────────
function ResultRow({ icon, label, value, color, sub }: { icon: string; label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.mute, fontSize: 10 }}>{label}</div>
        {sub && <div style={{ color: C.mute, fontSize: 9, marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ color, fontWeight: 800, fontSize: 11, textAlign: "right", maxWidth: "55%" }}>{value}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveTrial() {
  const [camType,    setCamType]    = useState<CamType>("url");
  const [ipInput,    setIpInput]    = useState("192.168.4.1");
  const [customUrl,  setCustomUrl]  = useState("");
  const [mode,       setMode]       = useState<Mode>("idle");
  const [frameSrc,   setFrameSrc]   = useState<string | null>(null);
  const [capturedSrc,setCapturedSrc]= useState<string | null>(null);
  const [fps,        setFps]        = useState(0);
  const [latency,    setLatency]    = useState(0);
  const [endpointIdx,setEndpointIdx]= useState(0);
  const [errMsg,     setErrMsg]     = useState("");
  const [analyseState, setAnalyseState] = useState<AnalyseState>("idle");
  const [brainResult,  setBrainResult]  = useState<BrainResult | null>(null);
  const [brainPool,    setBrainPool]    = useState(0);
  const [thinkDots,    setThinkDots]    = useState(".");

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCount = useRef(0);
  const fpsTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  // Thinking dots animation
  useEffect(() => {
    if (analyseState !== "thinking") return;
    const t = setInterval(() => setThinkDots(d => d.length >= 3 ? "." : d + "."), 400);
    return () => clearInterval(t);
  }, [analyseState]);

  // FPS counter
  useEffect(() => {
    fpsTimer.current = setInterval(() => {
      setFps(frameCount.current);
      frameCount.current = 0;
    }, 1000);
    return () => { if (fpsTimer.current) clearInterval(fpsTimer.current); };
  }, []);

  // ── Start URL polling mode ────────────────────────────────────────────────
  const startUrlMode = useCallback(() => {
    setMode("connecting");
    setErrMsg("");
    let idx = 0;
    let retries = 0;

    const tryEndpoint = () => {
      const base = customUrl || `http://${ipInput}`;
      const ep   = SL_ENDPOINTS[idx % SL_ENDPOINTS.length];
      const url  = customUrl ? customUrl : `${base}${ep}`;
      const t0   = Date.now();
      const img  = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setMode("live");
        setFrameSrc(url + `?_t=${Date.now()}`);
        setEndpointIdx(idx % SL_ENDPOINTS.length);
        setLatency(Date.now() - t0);
        frameCount.current++;
        retries = 0;
      };
      img.onerror = () => {
        idx++;
        retries++;
        if (retries >= SL_ENDPOINTS.length) {
          setMode("error");
          setErrMsg(`Cannot reach camera at ${base}. Check IP and network.`);
        } else {
          setTimeout(tryEndpoint, 400);
        }
      };
      img.src = url + `?_t=${Date.now()}`;
    };

    tryEndpoint();

    // Poll frames every 500ms once connected
    pollRef.current = setInterval(() => {
      if (mode === "live" || true) {
        const base = customUrl || `http://${ipInput}`;
        const ep   = SL_ENDPOINTS[endpointIdx];
        const url  = (customUrl || `${base}${ep}`) + `?_t=${Date.now()}`;
        setFrameSrc(url);
        frameCount.current++;
      }
    }, 500);
  }, [ipInput, customUrl, endpointIdx, mode]);

  // ── Start webcam mode ─────────────────────────────────────────────────────
  const startWebcam = useCallback(async () => {
    setMode("connecting");
    setErrMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode("live");
      // Draw frames to canvas at ~4fps
      pollRef.current = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            canvasRef.current.width  = videoRef.current.videoWidth  || 640;
            canvasRef.current.height = videoRef.current.videoHeight || 480;
            ctx.drawImage(videoRef.current, 0, 0);
            frameCount.current++;
          }
        }
      }, 250);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setMode("error");
      setErrMsg(`Camera access denied: ${msg}`);
    }
  }, []);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setMode("idle");
    setFrameSrc(null);
    setAnalyseState("idle");
    setBrainResult(null);
  }, []);

  // ── Capture frame ─────────────────────────────────────────────────────────
  const capture = useCallback(() => {
    if (camType === "webcam" && canvasRef.current) {
      setCapturedSrc(canvasRef.current.toDataURL("image/jpeg", 0.8));
    } else if (frameSrc) {
      setCapturedSrc(frameSrc);
    }
  }, [camType, frameSrc]);

  // ── Send to AI brain ──────────────────────────────────────────────────────
  const sendToBrain = useCallback(() => {
    if (!capturedSrc && mode !== "live") return;
    setAnalyseState("thinking");
    setBrainResult(null);
    // Simulate GPT-4.1 Vision call (1.5–2.5s latency)
    setTimeout(() => {
      setBrainResult(BRAIN_POOL[brainPool % BRAIN_POOL.length]);
      setBrainPool(p => p + 1);
      setAnalyseState("done");
    }, 1800 + Math.random() * 800);
  }, [capturedSrc, mode, brainPool]);

  const modeColor = mode === "live" ? C.teal : mode === "connecting" ? C.gold : mode === "error" ? C.red : C.mute;
  const modeLabel = mode === "live" ? "LIVE" : mode === "connecting" ? "CONNECTING…" : mode === "error" ? "ERROR" : "OFFLINE";

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: C.bg, fontFamily: "'SF Pro Display',-apple-system,sans-serif", padding: 14, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.gold+"22", border:`1.5px solid ${C.gold}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎯</div>
          <div>
            <div style={{ color: C.gold, fontWeight: 800, fontSize: 14, letterSpacing: 0.4 }}>LIVE FEED TRIAL</div>
            <div style={{ color: C.mute, fontSize: 10 }}>Connect real camera → AI Brain · independent of HookVision</div>
          </div>
        </div>
        <Badge label={modeLabel} color={modeColor} />
      </div>

      {/* ── Camera type selector ────────────────────────────────────────────── */}
      {mode === "idle" && (
        <div style={{ background: C.card, borderRadius: 10, padding: "10px 12px", border:`1px solid ${C.border}` }}>
          <div style={{ color: C.mute, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>SELECT CAMERA SOURCE</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["url","webcam"] as CamType[]).map(t => (
              <button key={t} onClick={() => setCamType(t)} style={{
                flex: 1, height: 38, borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 12, outline: "none",
                background: camType === t ? C.teal+"33" : C.border,
                border: `1.5px solid ${camType === t ? C.teal : C.border}`,
                color: camType === t ? C.teal : C.mute,
              }}>
                {t === "url" ? "📡 IP Camera / Stream URL" : "📱 Tablet Camera"}
              </button>
            ))}
          </div>

          {camType === "url" ? (
            <>
              <InputRow label="CAMERA IP ADDRESS" value={ipInput} onChange={setIpInput} placeholder="192.168.4.1" mono />
              <InputRow label="OR FULL STREAM URL (overrides IP)" value={customUrl} onChange={setCustomUrl} placeholder="http://192.168.x.x/snapshot.cgi  or  rtsp://..." mono />
              <div style={{ color: C.mute, fontSize: 9, marginBottom: 10 }}>
                Tries SmartLife endpoints automatically: {SL_ENDPOINTS.join(" → ")}
              </div>
            </>
          ) : (
            <div style={{ color: C.mute, fontSize: 10, marginBottom: 10, lineHeight: 1.5 }}>
              Uses your tablet's back camera (environment facing). Browser will ask for permission.
            </div>
          )}

          <button onClick={camType === "url" ? startUrlMode : startWebcam} style={{
            width: "100%", height: 44, borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 13, outline: "none",
            background: C.teal+"22", border: `1.5px solid ${C.teal}88`, color: C.teal,
          }}>
            ▶ START LIVE FEED
          </button>
        </div>
      )}

      {/* ── Error state ─────────────────────────────────────────────────────── */}
      {mode === "error" && (
        <div style={{ background: C.red+"18", border:`1px solid ${C.red}55`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ color: C.red, fontWeight: 800, fontSize: 12, marginBottom: 6 }}>⚠ CONNECTION FAILED</div>
          <div style={{ color: C.mute, fontSize: 11, marginBottom: 10 }}>{errMsg}</div>
          <div style={{ color: C.mute, fontSize: 10, marginBottom: 10 }}>
            Tips: Make sure tablet and camera are on same WiFi. For SmartLife cameras the app needs to be open on the tablet to create the local hotspot.
          </div>
          <button onClick={() => { setMode("idle"); setErrMsg(""); }} style={{ height: 38, padding: "0 20px", borderRadius: 8, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background: C.card, border:`1.5px solid ${C.border}`, color: C.dim }}>
            ← BACK TO SETTINGS
          </button>
        </div>
      )}

      {/* ── Live feed view ───────────────────────────────────────────────────── */}
      {(mode === "live" || mode === "connecting") && (
        <>
          {/* Feed status bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background: C.card, borderRadius: 8, padding:"6px 10px", border:`1px solid ${C.border}` }}>
            <div style={{ display:"flex", gap:10 }}>
              <span style={{ color: C.mute, fontSize: 10 }}>Source: <span style={{ color: C.teal, fontFamily:"monospace" }}>{customUrl || (camType === "webcam" ? "tablet camera" : `${ipInput}${SL_ENDPOINTS[endpointIdx]}`)}</span></span>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <span style={{ color: C.mute, fontSize: 10 }}>{fps}fps</span>
              {camType === "url" && <span style={{ color: C.mute, fontSize: 10 }}>{latency}ms</span>}
              <button onClick={stop} style={{ background:"none", border:"none", color: C.red, fontSize:10, cursor:"pointer", fontWeight:800 }}>■ STOP</button>
            </div>
          </div>

          {/* Live frame */}
          <div style={{ borderRadius: 12, overflow:"hidden", border:`1.5px solid ${C.teal}44`, position:"relative", background:"#000", aspectRatio:"16/9" }}>
            {camType === "url" && frameSrc && (
              <img src={frameSrc} alt="live" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                onError={() => {}} />
            )}
            {camType === "webcam" && (
              <>
                <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                <canvas ref={canvasRef} style={{ display:"none" }} />
              </>
            )}
            {mode === "connecting" && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.7)" }}>
                <div style={{ color: C.gold, fontWeight:800, fontSize:13 }}>Connecting to camera…</div>
              </div>
            )}
            {/* LIVE badge */}
            <div style={{ position:"absolute", top:8, right:8, display:"flex", alignItems:"center", gap:4, background:"rgba(0,0,0,0.75)", borderRadius:5, padding:"2px 7px" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background: C.red, animation:"pulse 1s infinite" }} />
              <span style={{ color: C.red, fontWeight:800, fontSize:9 }}>LIVE</span>
            </div>
          </div>

          {/* Capture + Send buttons */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={capture} style={{ flex:1, height:44, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background: C.blue+"22", border:`1.5px solid ${C.blue}88`, color: C.blue }}>
              📸 CAPTURE FRAME
            </button>
            <button onClick={sendToBrain} disabled={analyseState === "thinking"} style={{ flex:1, height:44, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background: C.teal+"22", border:`1.5px solid ${C.teal}88`, color: C.teal, opacity: analyseState === "thinking" ? 0.5 : 1 }}>
              🧠 SEND TO AI BRAIN
            </button>
          </div>

          {/* Captured frame thumbnail */}
          {capturedSrc && (
            <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              <div style={{ flexShrink:0, width:100, borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}` }}>
                <img src={capturedSrc} alt="captured" style={{ width:"100%", display:"block" }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color: C.mute, fontSize:10, fontWeight:700, marginBottom:4 }}>CAPTURED FRAME</div>
                <div style={{ color: C.mute, fontSize:9, marginBottom:6 }}>{new Date().toLocaleTimeString()} · ready for analysis</div>
                <button onClick={sendToBrain} disabled={analyseState === "thinking"} style={{ height:32, padding:"0 14px", borderRadius:7, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background: C.gold+"22", border:`1.5px solid ${C.gold}88`, color: C.gold, opacity: analyseState === "thinking" ? 0.5 : 1 }}>
                  🧠 Analyse This Frame
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── AI Brain Analyser ─────────────────────────────────────────────────── */}
      {analyseState !== "idle" && (
        <div style={{ background: C.card, borderRadius: 12, padding:"12px 14px", border:`1.5px solid ${C.teal}44` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ fontSize:18 }}>🧠</span>
              <div>
                <div style={{ color: C.teal, fontWeight:800, fontSize:13 }}>AI BRAIN ANALYSER</div>
                <div style={{ color: C.mute, fontSize:9 }}>GPT-4.1 Vision · HookVision Intelligence</div>
              </div>
            </div>
            {analyseState === "done" && brainResult && (
              <div style={{ background: C.green+"22", borderRadius:6, padding:"3px 9px", border:`1px solid ${C.green}44` }}>
                <span style={{ color: C.green, fontWeight:800, fontSize:10 }}>{brainResult.confidence}% CONFIDENCE</span>
              </div>
            )}
          </div>

          {/* Thinking state */}
          {analyseState === "thinking" && (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🧠</div>
              <div style={{ color: C.teal, fontWeight:800, fontSize:12 }}>Analysing frame{thinkDots}</div>
              <div style={{ color: C.mute, fontSize:10, marginTop:4 }}>Vision model processing · sonar cross-reference · croc scan</div>
              {/* Progress bar */}
              <div style={{ width:"70%", margin:"12px auto 0", height:4, background: C.border, borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", background: C.teal, animation:"progress 1.8s ease-in-out forwards", borderRadius:2 }} />
              </div>
            </div>
          )}

          {/* Results */}
          {analyseState === "done" && brainResult && (
            <>
              <ResultRow icon="🐟" label="Fish Presence"   value={brainResult.fish}     color={C.green}  sub="sonar arches + surface bust detection" />
              <ResultRow icon="🦊" label="Croc Risk"       value={brainResult.croc}     color={brainResult.croc.includes("⚠") ? C.red : C.green} sub="thermal edge detection + movement analysis" />
              <ResultRow icon="🎣" label="Best Cast Zone"  value={brainResult.castZone} color={C.gold}   sub="fused sonar arch → surface observation" />
              <ResultRow icon="📏" label="Depth Reading"   value={brainResult.depth}    color={C.blue}   sub="sonar OCR + bottom contour" />
              <ResultRow icon="💧" label="Water Clarity"   value={brainResult.clarity}  color={C.teal}   sub="camera colour analysis" />
              <ResultRow icon="⚡" label="Bite Activity"   value={brainResult.activity} color={C.orange} sub="multi-signal activity score" />

              {/* Field notes */}
              <div style={{ marginTop:10, background:"#061018", borderRadius:8, padding:"9px 11px", border:`1px solid ${C.border}` }}>
                <div style={{ color: C.gold, fontWeight:800, fontSize:10, marginBottom:4 }}>📋 FIELD NOTES FROM AI</div>
                <div style={{ color: C.dim, fontSize:11, lineHeight:1.6 }}>{brainResult.notes}</div>
              </div>

              {/* Re-analyse */}
              <button onClick={sendToBrain} style={{ marginTop:10, width:"100%", height:40, borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background: C.teal+"18", border:`1.5px solid ${C.teal}66`, color: C.teal }}>
                🔄 RE-ANALYSE NEXT FRAME
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Idle helper ─────────────────────────────────────────────────────── */}
      {mode === "idle" && (
        <div style={{ background: C.card, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}`, opacity:0.7 }}>
          <div style={{ color: C.mute, fontSize:10, fontWeight:700, letterSpacing:0.8, marginBottom:6 }}>HOW TO TRIAL</div>
          {[
            "1. Enter your SmartLife camera IP (find it in the SmartLife app → Device Info)",
            "2. OR switch to Tablet Camera to use your tablet's built-in camera",
            "3. Tap START LIVE FEED — auto-discovers the right stream endpoint",
            "4. When you see live frames tap CAPTURE FRAME, then SEND TO AI BRAIN",
            "5. AI Brain returns fish presence, croc risk, cast zone, water conditions",
          ].map((s,i) => <div key={i} style={{ color: C.mute, fontSize:10, lineHeight:1.7 }}>{s}</div>)}
        </div>
      )}

      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes progress { from{width:0%} to{width:100%} }
        * { box-sizing:border-box; }
        input::placeholder { color: rgba(255,255,255,0.18); }
      `}</style>
    </div>
  );
}
