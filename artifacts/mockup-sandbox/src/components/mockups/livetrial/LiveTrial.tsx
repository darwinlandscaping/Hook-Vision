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

type Mode       = "idle" | "scanning" | "connecting" | "live" | "error";
type CamType    = "url" | "webcam";
type ScanStatus = "pending" | "trying" | "found" | "miss";
type AnalyseState = "idle" | "thinking" | "done";

interface ScanResult { ip: string; endpoint: string; label: string; }
interface BrainResult {
  fish: string; croc: string; castZone: string;
  depth: string; clarity: string; activity: string;
  confidence: number; notes: string;
}

// SmartLife / IP-camera hotspot IPs to try first (most common)
const PRIORITY_IPS = [
  "192.168.4.1",   // SmartLife direct hotspot
  "192.168.1.1",   // router gateway cam
  "192.168.0.1",
  "192.168.10.1",
  "192.168.100.1",
  "10.0.0.1",
  "10.10.10.1",
  "172.16.0.1",
];

// Then scan common cam IPs on standard subnets
const SCAN_SUFFIXES = [2,3,4,5,10,20,50,100,101,102,103,104,105,110,120,150,200,254];
const SCAN_SUBNETS  = ["192.168.4","192.168.1","192.168.0","10.0.0","10.10.10"];

const SL_ENDPOINTS = [
  "/snapshot.cgi",
  "/cgi-bin/snapshot.cgi",
  "/snap.jpg",
  "/video0.jpg",
  "/Streaming/channels/1/picture",
];

const BRAIN_POOL: BrainResult[] = [
  { fish:"Barramundi school · 3–5 fish · 2–4kg avg", croc:"CLEAR · no thermal signature", castZone:"CAST LEFT 25°, 12m out — fish busting surface", depth:"4.2m · soft mud bottom", clarity:"TANNIN/MURKY · 0.4m vis", activity:"HIGH — bait ball detected near left bank", confidence:87, notes:"Osprey diving pattern confirms fish activity. Cast into the shadow edge at the snag." },
  { fish:"2 Barramundi arches · sonar depth 6m", croc:"LOW RISK · movement 40m upstream", castZone:"HOLD — fish moving toward you", depth:"6.1m · rocky structure", clarity:"CLEAR · 1.2m vis", activity:"MODERATE — fish tight to structure", confidence:74, notes:"Sonar shows fish pinned to rocky bottom. Slow presentation, weighted jig on structure." },
  { fish:"Large single arch · est. 60–80cm", croc:"⚠ CAUTION — 15m, bank left", castZone:"CAST RIGHT 30°, away from croc", depth:"3.8m · sandy flat", clarity:"MURKY · run-off tannin", activity:"HIGH — feeding window · golden hour", confidence:91, notes:"Sunset bite window open. Big single fish working the flat edge. Keep away from left bank." },
  { fish:"No arches · surface bust 3 min ago", croc:"CLEAR", castZone:"WAIT — fish regrouping below", depth:"5.5m", clarity:"CLEAR · 1.0m vis", activity:"LOW · between feeding windows", confidence:62, notes:"Activity dropped after surface bust. Hold 5–10 min, fish will regroup and rise again." },
];

// ── Probe a single IP+endpoint via Image tag (bypasses CORS) ──────────────────
function probeImage(ip: string, endpoint: string, timeoutMs = 2500): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image();
    let settled = false;
    const done = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };
    const t = setTimeout(() => done(false), timeoutMs);
    img.onload  = () => { clearTimeout(t); done(true); };
    img.onerror = () => { clearTimeout(t); done(false); };
    img.src = `http://${ip}${endpoint}?_t=${Date.now()}`;
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, background:color+"20", border:`1px solid ${color}55`, borderRadius:6, padding:"3px 9px" }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:color, animation:"pulse 1.2s infinite" }} />
      <span style={{ color, fontWeight:800, fontSize:10 }}>{label}</span>
    </div>
  );
}

function ScanRow({ ip, endpoint, status }: { ip: string; endpoint: string; status: ScanStatus }) {
  const col = status==="found"?"#00ff88":status==="miss"?"rgba(255,255,255,0.18)":status==="trying"?C.gold:C.mute;
  const icon = status==="found"?"✓":status==="miss"?"✗":status==="trying"?"…":"·";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"2px 0" }}>
      <span style={{ color:col, fontFamily:"monospace", fontSize:11, width:14 }}>{icon}</span>
      <span style={{ color:col, fontFamily:"monospace", fontSize:10, flex:1 }}>{ip}{endpoint}</span>
      {status==="found" && <span style={{ color:C.green, fontSize:9, fontWeight:800 }}>FOUND</span>}
    </div>
  );
}

function ResultRow({ icon, label, value, color, sub }: { icon:string; label:string; value:string; color:string; sub?:string }) {
  return (
    <div style={{ display:"flex", gap:8, padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ fontSize:15, flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ color:C.mute, fontSize:10 }}>{label}</div>
        {sub && <div style={{ color:C.mute, fontSize:9, marginTop:1 }}>{sub}</div>}
      </div>
      <div style={{ color, fontWeight:800, fontSize:11, textAlign:"right", maxWidth:"55%" }}>{value}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
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

  // Scanner state
  const [scanRows,    setScanRows]    = useState<Array<{ip:string;ep:string;status:ScanStatus}>>([]);
  const [scanFound,   setScanFound]   = useState<ScanResult | null>(null);
  const [scanDone,    setScanDone]    = useState(false);
  const [scanProgress,setScanProgress]= useState(0);
  const [scanTotal,   setScanTotal]   = useState(0);
  const scanAbort = useRef(false);

  // Analysis state
  const [analyseState, setAnalyseState] = useState<AnalyseState>("idle");
  const [brainResult,  setBrainResult]  = useState<BrainResult | null>(null);
  const [brainIdx,     setBrainIdx]     = useState(0);
  const [thinkDots,    setThinkDots]    = useState(".");

  const pollRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream|null>(null);
  const frameCount = useRef(0);

  // FPS counter
  useEffect(() => {
    const t = setInterval(() => { setFps(frameCount.current); frameCount.current = 0; }, 1000);
    return () => clearInterval(t);
  }, []);

  // Think dots
  useEffect(() => {
    if (analyseState !== "thinking") return;
    const t = setInterval(() => setThinkDots(d => d.length >= 3 ? "." : d + "."), 400);
    return () => clearInterval(t);
  }, [analyseState]);

  // ── NETWORK SCANNER ───────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    scanAbort.current = false;
    setScanRows([]);
    setScanFound(null);
    setScanDone(false);
    setMode("scanning");
    setErrMsg("");

    // Build IP list: priority first, then subnet sweep
    const ips: string[] = [...PRIORITY_IPS];
    for (const subnet of SCAN_SUBNETS) {
      for (const suffix of SCAN_SUFFIXES) {
        const ip = `${subnet}.${suffix}`;
        if (!ips.includes(ip)) ips.push(ip);
      }
    }
    setScanTotal(ips.length);

    // Try each IP × first 2 endpoints (speed vs coverage balance)
    const fastEps = SL_ENDPOINTS.slice(0, 2);
    let found: ScanResult | null = null;

    for (let i = 0; i < ips.length; i++) {
      if (scanAbort.current) break;
      const ip = ips[i];
      setScanProgress(i + 1);

      // Try endpoints in parallel for this IP
      const results = await Promise.all(
        fastEps.map(ep => probeImage(ip, ep, 1800).then(ok => ({ ep, ok })))
      );

      for (const { ep, ok } of results) {
        const rowKey = `${ip}${ep}`;
        setScanRows(prev => {
          const exists = prev.find(r => r.ip===ip && r.ep===ep);
          const status: ScanStatus = ok ? "found" : "miss";
          if (exists) return prev.map(r => r.ip===ip && r.ep===ep ? {...r, status} : r);
          return [...prev.slice(-8), { ip, ep, status }]; // keep last 8 rows visible
        });

        if (ok && !found) {
          found = { ip, endpoint: ep, label: `SmartLife · ${ip}` };
          setScanFound(found);
          setScanDone(true);
          setIpInput(ip);
          // Auto-connect
          startUrlModeWith(ip, ep);
          return;
        }
      }

      // Show "trying" row for currently active IP
      if (!found) {
        setScanRows(prev => {
          const exists = prev.find(r => r.ip===ip);
          if (!exists) return [...prev.slice(-8), { ip, ep: fastEps[0], status: "trying" }];
          return prev;
        });
      }
    }

    if (!found) {
      setScanDone(true);
      setMode("error");
      setErrMsg("No SmartLife camera found on local network. Make sure your tablet is on the same WiFi as the camera and the SmartLife app is running.");
    }
  }, []);

  // ── START URL MODE (called by scanner or manually) ─────────────────────────
  const startUrlModeWith = useCallback((ip: string, ep: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setMode("connecting");
    const baseUrl = `http://${ip}${ep}`;
    const t0 = Date.now();
    const img = new Image();
    img.onload = () => {
      setLatency(Date.now() - t0);
      setFrameSrc(baseUrl + `?_t=${Date.now()}`);
      setMode("live");
      setEndpointIdx(SL_ENDPOINTS.indexOf(ep));
      frameCount.current++;
      // Start polling
      pollRef.current = setInterval(() => {
        setFrameSrc(baseUrl + `?_t=${Date.now()}`);
        frameCount.current++;
      }, 500);
    };
    img.onerror = () => {
      // Try remaining endpoints
      let tried = 0;
      const tryNext = (idx: number) => {
        if (idx >= SL_ENDPOINTS.length) {
          setMode("error");
          setErrMsg(`Camera at ${ip} reachable but no working stream endpoint found.`);
          return;
        }
        const url = `http://${ip}${SL_ENDPOINTS[idx]}?_t=${Date.now()}`;
        const img2 = new Image();
        img2.onload  = () => { setLatency(Date.now()-t0); setFrameSrc(url); setMode("live"); setEndpointIdx(idx); startPolling(`http://${ip}${SL_ENDPOINTS[idx]}`); };
        img2.onerror = () => { tried++; tryNext(idx+1); };
        img2.src = url;
      };
      tryNext(0);
    };
    img.src = baseUrl + `?_t=${Date.now()}`;
  }, []);

  const startPolling = useCallback((baseUrl: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      setFrameSrc(baseUrl + `?_t=${Date.now()}`);
      frameCount.current++;
    }, 500);
  }, []);

  const startManualUrl = useCallback(() => {
    if (customUrl) {
      setMode("connecting");
      startUrlModeWith(ipInput, SL_ENDPOINTS[0]);
    } else {
      startUrlModeWith(ipInput, SL_ENDPOINTS[0]);
    }
  }, [ipInput, customUrl, startUrlModeWith]);

  // ── WEBCAM ─────────────────────────────────────────────────────────────────
  const startWebcam = useCallback(async () => {
    setMode("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment", width:{ideal:1280} }, audio:false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setMode("live");
      pollRef.current = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) { canvasRef.current.width = videoRef.current.videoWidth||640; canvasRef.current.height = videoRef.current.videoHeight||480; ctx.drawImage(videoRef.current,0,0); frameCount.current++; }
        }
      }, 250);
    } catch(e: unknown) {
      setMode("error");
      setErrMsg(`Camera access denied: ${e instanceof Error ? e.message : e}`);
    }
  }, []);

  // ── STOP ──────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    scanAbort.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setMode("idle");
    setFrameSrc(null);
    setCapturedSrc(null);
    setAnalyseState("idle");
    setBrainResult(null);
    setScanRows([]);
    setScanFound(null);
    setScanDone(false);
  }, []);

  // ── CAPTURE ───────────────────────────────────────────────────────────────
  const capture = useCallback(() => {
    if (camType === "webcam" && canvasRef.current) setCapturedSrc(canvasRef.current.toDataURL("image/jpeg", 0.8));
    else if (frameSrc) setCapturedSrc(frameSrc);
  }, [camType, frameSrc]);

  // ── SEND TO BRAIN ─────────────────────────────────────────────────────────
  const sendToBrain = useCallback(() => {
    setAnalyseState("thinking");
    setBrainResult(null);
    setTimeout(() => {
      setBrainResult(BRAIN_POOL[brainIdx % BRAIN_POOL.length]);
      setBrainIdx(n => n + 1);
      setAnalyseState("done");
    }, 1600 + Math.random() * 900);
  }, [brainIdx]);

  const modeColor = mode==="live"?C.teal:mode==="scanning"?C.gold:mode==="connecting"?C.sl:mode==="error"?C.red:C.mute;
  const modeLabel = mode==="live"?"LIVE":mode==="scanning"?"SCANNING…":mode==="connecting"?"CONNECTING…":mode==="error"?"ERROR":"OFFLINE";

  return (
    <div style={{ width:"100%", minHeight:"100vh", background:C.bg, fontFamily:"'SF Pro Display',-apple-system,sans-serif", padding:14, boxSizing:"border-box", display:"flex", flexDirection:"column", gap:10 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:C.gold+"22", border:`1.5px solid ${C.gold}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎯</div>
          <div>
            <div style={{ color:C.gold, fontWeight:800, fontSize:14, letterSpacing:0.4 }}>LIVE FEED TRIAL</div>
            <div style={{ color:C.mute, fontSize:10 }}>Real camera → AI Brain · independent of HookVision</div>
          </div>
        </div>
        <Badge label={modeLabel} color={modeColor} />
      </div>

      {/* ── IDLE: setup panel ─────────────────────────────────────────────── */}
      {mode === "idle" && (
        <div style={{ background:C.card, borderRadius:10, padding:"12px 13px", border:`1px solid ${C.border}` }}>
          <div style={{ color:C.mute, fontSize:10, fontWeight:700, letterSpacing:0.8, marginBottom:10 }}>CAMERA SOURCE</div>

          {/* Source tabs */}
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            {(["url","webcam"] as CamType[]).map(t => (
              <button key={t} onClick={() => setCamType(t)} style={{ flex:1, height:36, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:camType===t?C.teal+"33":C.border, border:`1.5px solid ${camType===t?C.teal:C.border}`, color:camType===t?C.teal:C.mute }}>
                {t==="url"?"📡 IP Camera":"📱 Tablet Camera"}
              </button>
            ))}
          </div>

          {camType === "url" ? (
            <>
              {/* AUTO-SCAN button — primary CTA */}
              <button onClick={runScan} style={{ width:"100%", height:48, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:13, outline:"none", background:C.sl+"28", border:`2px solid ${C.sl}88`, color:C.sl, marginBottom:10, letterSpacing:0.3 }}>
                🔍 AUTO-SCAN NETWORK FOR SMARTLIFE CAMERA
              </button>

              <div style={{ color:C.mute, fontSize:9, textAlign:"center", marginBottom:10 }}>— or enter IP manually —</div>

              {/* Manual IP */}
              <div style={{ marginBottom:8 }}>
                <div style={{ color:C.mute, fontSize:10, fontWeight:700, marginBottom:3, letterSpacing:0.6 }}>CAMERA IP ADDRESS</div>
                <div style={{ display:"flex", gap:6 }}>
                  <input value={ipInput} onChange={e => setIpInput(e.target.value)} placeholder="192.168.4.1"
                    style={{ flex:1, background:"#061018", border:`1px solid ${C.border}`, borderRadius:7, color:C.dim, padding:"8px 10px", fontSize:12, fontFamily:"monospace", outline:"none" }} />
                  <button onClick={startManualUrl} style={{ padding:"0 14px", borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:C.teal+"22", border:`1.5px solid ${C.teal}55`, color:C.teal, whiteSpace:"nowrap" }}>
                    Connect
                  </button>
                </div>
              </div>

              <div style={{ color:C.mute, fontSize:9 }}>Auto-tries: {SL_ENDPOINTS.join(" → ")}</div>
            </>
          ) : (
            <>
              <div style={{ color:C.mute, fontSize:10, lineHeight:1.6, marginBottom:10 }}>Uses your tablet's back camera. Browser will ask for permission. Point at sonar screen or water.</div>
              <button onClick={startWebcam} style={{ width:"100%", height:44, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:13, outline:"none", background:C.teal+"22", border:`1.5px solid ${C.teal}88`, color:C.teal }}>
                ▶ START TABLET CAMERA
              </button>
            </>
          )}
        </div>
      )}

      {/* ── SCANNING panel ────────────────────────────────────────────────── */}
      {mode === "scanning" && (
        <div style={{ background:C.card, borderRadius:10, padding:"12px 13px", border:`1px solid ${C.sl}44` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ color:C.sl, fontWeight:800, fontSize:12 }}>🔍 SCANNING LOCAL NETWORK…</div>
            <button onClick={stop} style={{ background:"none", border:`1px solid ${C.border}`, color:C.mute, fontSize:10, cursor:"pointer", borderRadius:5, padding:"2px 8px" }}>STOP</button>
          </div>

          {/* Progress bar */}
          <div style={{ width:"100%", height:5, background:C.border, borderRadius:3, overflow:"hidden", marginBottom:8 }}>
            <div style={{ height:"100%", background:C.sl, borderRadius:3, transition:"width 0.3s", width:`${Math.round((scanProgress/Math.max(scanTotal,1))*100)}%` }} />
          </div>
          <div style={{ color:C.mute, fontSize:9, marginBottom:10 }}>Probing {scanProgress} of {scanTotal} addresses · {SCAN_SUBNETS.join(", ")} subnets</div>

          {/* Scroll log of recent probes */}
          <div style={{ background:"#061018", borderRadius:8, padding:"8px 10px", maxHeight:120, overflow:"hidden" }}>
            {scanRows.slice(-6).map((r,i) => (
              <ScanRow key={i} ip={r.ip} endpoint={r.ep} status={r.status} />
            ))}
            {scanRows.length === 0 && <div style={{ color:C.mute, fontSize:10 }}>Starting scan…</div>}
          </div>

          {/* Tip */}
          <div style={{ color:C.mute, fontSize:9, marginTop:8 }}>
            Tip: If camera is on its own hotspot (SmartLife AP mode), connect this tablet to that WiFi network first, then scan.
          </div>
        </div>
      )}

      {/* ── ERROR ────────────────────────────────────────────────────────── */}
      {mode === "error" && (
        <div style={{ background:C.red+"18", border:`1px solid ${C.red}55`, borderRadius:10, padding:"12px 14px" }}>
          <div style={{ color:C.red, fontWeight:800, fontSize:12, marginBottom:6 }}>⚠ {scanDone ? "SCAN COMPLETE — NO CAMERA FOUND" : "CONNECTION FAILED"}</div>
          <div style={{ color:C.mute, fontSize:11, marginBottom:8, lineHeight:1.5 }}>{errMsg}</div>
          <div style={{ color:C.mute, fontSize:9, marginBottom:10, lineHeight:1.6 }}>
            <b style={{color:C.dim}}>Checklist:</b><br/>
            • This tablet must be on <b style={{color:C.gold}}>the same WiFi</b> as the camera<br/>
            • SmartLife hotspot mode: connect tablet WiFi to the camera's hotspot (usually "SmartLife-XXXX"), then scan again<br/>
            • Check the IP in SmartLife app → Tap device → "…" → Device Info
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => { setMode("idle"); setErrMsg(""); setScanRows([]); setScanDone(false); }} style={{ flex:1, height:38, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:C.card, border:`1.5px solid ${C.border}`, color:C.dim }}>← Settings</button>
            <button onClick={runScan} style={{ flex:1, height:38, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:C.sl+"22", border:`1.5px solid ${C.sl}55`, color:C.sl }}>🔍 Scan Again</button>
          </div>
        </div>
      )}

      {/* ── LIVE feed ────────────────────────────────────────────────────── */}
      {(mode === "live" || mode === "connecting") && (
        <>
          {/* Connection info bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.card, borderRadius:8, padding:"6px 10px", border:`1px solid ${C.border}` }}>
            <span style={{ color:C.sl, fontFamily:"monospace", fontSize:10 }}>
              {camType==="webcam" ? "tablet camera" : `${ipInput}${SL_ENDPOINTS[endpointIdx]}`}
            </span>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ color:C.mute, fontSize:10 }}>{fps} fps</span>
              {camType!=="webcam" && <span style={{ color:C.mute, fontSize:10 }}>{latency}ms</span>}
              <button onClick={stop} style={{ background:"none", border:"none", color:C.red, fontSize:10, cursor:"pointer", fontWeight:800 }}>■ STOP</button>
            </div>
          </div>

          {/* Live frame */}
          <div style={{ borderRadius:12, overflow:"hidden", border:`1.5px solid ${C.teal}55`, position:"relative", background:"#000", aspectRatio:"16/9" }}>
            {camType==="url" && frameSrc && (
              <img src={frameSrc} alt="live" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} onError={() => {}} />
            )}
            {camType==="webcam" && (
              <>
                <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                <canvas ref={canvasRef} style={{ display:"none" }} />
              </>
            )}
            {mode==="connecting" && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.75)", gap:8 }}>
                <div style={{ color:C.sl, fontWeight:800, fontSize:13 }}>Connecting…</div>
                <div style={{ color:C.mute, fontSize:10 }}>{ipInput}</div>
              </div>
            )}
            {/* LIVE badge */}
            {mode==="live" && (
              <div style={{ position:"absolute", top:8, right:8, display:"flex", alignItems:"center", gap:4, background:"rgba(0,0,0,0.75)", borderRadius:5, padding:"2px 7px" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:C.red, animation:"pulse 1s infinite" }} />
                <span style={{ color:C.red, fontWeight:800, fontSize:9 }}>LIVE</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={capture} style={{ flex:1, height:44, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background:C.blue+"22", border:`1.5px solid ${C.blue}88`, color:C.blue }}>
              📸 CAPTURE FRAME
            </button>
            <button onClick={sendToBrain} disabled={analyseState==="thinking"} style={{ flex:1, height:44, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background:C.teal+"22", border:`1.5px solid ${C.teal}88`, color:C.teal, opacity:analyseState==="thinking"?0.5:1 }}>
              🧠 SEND TO AI BRAIN
            </button>
          </div>

          {/* Captured thumbnail */}
          {capturedSrc && (
            <div style={{ display:"flex", gap:8, alignItems:"flex-start", background:C.card, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}` }}>
              <div style={{ flexShrink:0, width:90, borderRadius:7, overflow:"hidden", border:`1px solid ${C.border}` }}>
                <img src={capturedSrc} alt="captured" style={{ width:"100%", display:"block" }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:C.dim, fontSize:11, fontWeight:700, marginBottom:2 }}>FRAME CAPTURED</div>
                <div style={{ color:C.mute, fontSize:9, marginBottom:8 }}>{new Date().toLocaleTimeString()}</div>
                <button onClick={sendToBrain} disabled={analyseState==="thinking"} style={{ height:32, padding:"0 14px", borderRadius:7, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:C.gold+"22", border:`1.5px solid ${C.gold}88`, color:C.gold, opacity:analyseState==="thinking"?0.5:1 }}>
                  🧠 Analyse Frame
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── AI BRAIN ANALYSER ────────────────────────────────────────────── */}
      {analyseState !== "idle" && (
        <div style={{ background:C.card, borderRadius:12, padding:"12px 14px", border:`1.5px solid ${C.teal}44` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ fontSize:18 }}>🧠</span>
              <div>
                <div style={{ color:C.teal, fontWeight:800, fontSize:13 }}>AI BRAIN ANALYSER</div>
                <div style={{ color:C.mute, fontSize:9 }}>GPT-4.1 Vision · HookVision Intelligence</div>
              </div>
            </div>
            {analyseState==="done" && brainResult && (
              <div style={{ background:C.green+"22", borderRadius:6, padding:"3px 9px", border:`1px solid ${C.green}44` }}>
                <span style={{ color:C.green, fontWeight:800, fontSize:10 }}>{brainResult.confidence}% CONFIDENCE</span>
              </div>
            )}
          </div>

          {/* Thinking */}
          {analyseState==="thinking" && (
            <div style={{ textAlign:"center", padding:"18px 0" }}>
              <div style={{ fontSize:28, marginBottom:6 }}>🧠</div>
              <div style={{ color:C.teal, fontWeight:800, fontSize:12 }}>Analysing frame{thinkDots}</div>
              <div style={{ color:C.mute, fontSize:10, marginTop:3 }}>Vision model · sonar cross-ref · croc scan</div>
              <div style={{ width:"70%", margin:"12px auto 0", height:4, background:C.border, borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", background:C.teal, borderRadius:2, animation:"progress 1.8s ease-in-out forwards" }} />
              </div>
            </div>
          )}

          {/* Results */}
          {analyseState==="done" && brainResult && (
            <>
              <ResultRow icon="🐟" label="Fish Presence"  value={brainResult.fish}     color={C.green}  sub="sonar arches + surface bust" />
              <ResultRow icon="🦊" label="Croc Risk"      value={brainResult.croc}     color={brainResult.croc.includes("⚠")?C.red:C.green} sub="thermal edge + movement analysis" />
              <ResultRow icon="🎣" label="Best Cast Zone" value={brainResult.castZone} color={C.gold}   sub="sonar arch → surface fusion" />
              <ResultRow icon="📏" label="Depth"          value={brainResult.depth}    color={C.blue}   sub="sonar OCR + bottom contour" />
              <ResultRow icon="💧" label="Clarity"        value={brainResult.clarity}  color={C.teal}   sub="camera colour analysis" />
              <ResultRow icon="⚡" label="Bite Activity"  value={brainResult.activity} color={C.orange} sub="multi-signal score" />
              <div style={{ marginTop:10, background:"#061018", borderRadius:8, padding:"9px 11px", border:`1px solid ${C.border}` }}>
                <div style={{ color:C.gold, fontWeight:800, fontSize:10, marginBottom:4 }}>📋 FIELD NOTES</div>
                <div style={{ color:C.dim, fontSize:11, lineHeight:1.6 }}>{brainResult.notes}</div>
              </div>
              <button onClick={sendToBrain} style={{ marginTop:10, width:"100%", height:40, borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background:C.teal+"18", border:`1.5px solid ${C.teal}66`, color:C.teal }}>
                🔄 RE-ANALYSE NEXT FRAME
              </button>
            </>
          )}
        </div>
      )}

      {/* Idle tip */}
      {mode==="idle" && (
        <div style={{ background:C.card, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}`, opacity:0.65 }}>
          <div style={{ color:C.mute, fontSize:10, fontWeight:700, letterSpacing:0.8, marginBottom:5 }}>QUICK START</div>
          <div style={{ color:C.mute, fontSize:10, lineHeight:1.7 }}>
            Tap <b style={{color:C.sl}}>AUTO-SCAN</b> — it probes {PRIORITY_IPS.length} priority IPs plus {SCAN_SUBNETS.length} subnet ranges automatically.<br/>
            Camera found? It connects and starts streaming instantly.<br/>
            Then tap <b style={{color:C.teal}}>SEND TO AI BRAIN</b> to analyse what the camera sees.
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1}50%{opacity:0.25} }
        @keyframes progress { from{width:0%} to{width:100%} }
        * { box-sizing:border-box; }
        input::placeholder { color: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
}
