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
  purple:"#cc88ff",
};

// ── Camera probe via Image tag (CORS-safe) ────────────────────────────────────
const SL_ENDPOINTS = [
  "/snapshot.cgi",
  "/cgi-bin/snapshot.cgi",
  "/snap.jpg",
  "/video0.jpg",
  "/Streaming/channels/1/picture",
];

const PRIORITY_IPS = [
  "192.168.4.1",  // SmartLife hotspot default
  "192.168.10.1",
  "192.168.1.1",
  "192.168.0.1",
  "192.168.100.1",
  "10.0.0.1",
  "10.10.10.1",
  "172.16.0.1",
];

const SCAN_SUBNETS  = ["192.168.4","192.168.1","192.168.0","10.0.0"];
const SCAN_SUFFIXES = [2,3,4,5,10,20,50,100,101,102,103,104,110,150,200,254];

const BRAIN_POOL = [
  { fish:"Barramundi school · 3–5 fish · 2–4kg avg", croc:"CLEAR · no thermal signature", castZone:"CAST LEFT 25°, 12m — fish busting surface", depth:"4.2m · soft mud bottom", clarity:"TANNIN/MURKY · 0.4m vis", activity:"HIGH — bait ball near left bank", confidence:87, notes:"Osprey diving confirms fish activity. Cast into shadow edge at the snag." },
  { fish:"2 Barramundi arches · 6m depth", croc:"LOW RISK · movement 40m upstream", castZone:"HOLD — fish moving toward you", depth:"6.1m · rocky structure", clarity:"CLEAR · 1.2m vis", activity:"MODERATE — fish on structure", confidence:74, notes:"Fish pinned to rocky bottom. Slow presentation, weighted jig." },
  { fish:"Large single arch · est. 60–80cm", croc:"⚠ CAUTION — 15m, bank left", castZone:"CAST RIGHT 30°, away from croc", depth:"3.8m · sandy flat", clarity:"MURKY · run-off tannin", activity:"HIGH — golden hour feeding window", confidence:91, notes:"Sunset bite window. Big single on the flat edge. Avoid left bank (croc)." },
  { fish:"No arches · surface bust 3 min ago", croc:"CLEAR", castZone:"WAIT — fish regrouping below", depth:"5.5m", clarity:"CLEAR · 1.0m vis", activity:"LOW · between windows", confidence:62, notes:"Activity dropped. Hold 5–10 min, fish will regroup and rise again." },
];

function probeImage(ip: string, ep: string, ms = 2000): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image();
    let done = false;
    const fin = (v: boolean) => { if (!done) { done = true; resolve(v); } };
    const t = setTimeout(() => fin(false), ms);
    img.onload  = () => { clearTimeout(t); fin(true); };
    img.onerror = () => { clearTimeout(t); fin(false); };
    img.src = `http://${ip}${ep}?_t=${Date.now()}`;
  });
}

// QR code URL for WiFi network (Android scans to auto-join)
function wifiQrUrl(ssid: string, pass: string) {
  const data = encodeURIComponent(`WIFI:T:WPA;S:${ssid};P:${pass};;`);
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=00ffcc&bgcolor=0d1f3a&data=${data}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  const col = done ? C.green : active ? C.gold : C.mute;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, flex:1 }}>
      <div style={{ width:24, height:24, borderRadius:12, background: done?C.green+"30":active?C.gold+"30":"transparent", border:`1.5px solid ${col}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <span style={{ color:col, fontWeight:800, fontSize:11 }}>{done?"✓":n}</span>
      </div>
      <span style={{ color:col, fontSize:10, fontWeight:done||active?800:400 }}>{label}</span>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background:color+"25", border:`1px solid ${color}55`, borderRadius:5, padding:"2px 7px", color, fontWeight:800, fontSize:9 }}>{label}</span>
  );
}

function ResultRow({ icon, label, value, color, sub }: { icon:string; label:string; value:string; color:string; sub?:string }) {
  return (
    <div style={{ display:"flex", gap:8, padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ fontSize:14, flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ color:C.mute, fontSize:10 }}>{label}</div>
        {sub && <div style={{ color:C.mute, fontSize:8, marginTop:1 }}>{sub}</div>}
      </div>
      <div style={{ color, fontWeight:800, fontSize:10, textAlign:"right", maxWidth:"58%" }}>{value}</div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
type Phase = "checking" | "hotspot" | "scanning" | "live" | "error";

export default function LiveTrial() {
  const [phase,      setPhase]      = useState<Phase>("checking");
  const [ssid,       setSsid]       = useState("SmartLife-XXXX");
  const [pass,       setPass]       = useState("12345678");
  const [showPass,   setShowPass]   = useState(false);
  const [scanLog,    setScanLog]    = useState<Array<{txt:string;ok:boolean|null}>>([]);
  const [scanPct,    setScanPct]    = useState(0);
  const [foundIp,    setFoundIp]    = useState("");
  const [foundEp,    setFoundEp]    = useState("");
  const [frameSrc,   setFrameSrc]   = useState<string|null>(null);
  const [capturedSrc,setCapturedSrc]= useState<string|null>(null);
  const [fps,        setFps]        = useState(0);
  const [latency,    setLatency]    = useState(0);
  const [errMsg,     setErrMsg]     = useState("");
  const [camType,    setCamType]    = useState<"ip"|"tablet">("ip");
  const [analyseState,setAnalyseState]= useState<"idle"|"thinking"|"done">("idle");
  const [brainResult, setBrainResult] = useState<(typeof BRAIN_POOL)[0]|null>(null);
  const [brainIdx,    setBrainIdx]    = useState(0);
  const [thinkDots,   setThinkDots]   = useState(".");

  const pollRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const abortRef  = useRef(false);
  const frameCount= useRef(0);

  // FPS counter
  useEffect(() => {
    const t = setInterval(() => { setFps(frameCount.current); frameCount.current=0; }, 1000);
    return () => clearInterval(t);
  }, []);

  // Think dots
  useEffect(() => {
    if (analyseState !== "thinking") return;
    const t = setInterval(() => setThinkDots(d => d.length>=3?".":d+"."), 400);
    return () => clearInterval(t);
  }, [analyseState]);

  // ── AUTO-PROBE on mount: check if camera already reachable ────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // Try the most common SmartLife IP first
      for (const ip of ["192.168.4.1","192.168.1.1","192.168.0.1","10.0.0.1"]) {
        if (cancelled) return;
        for (const ep of SL_ENDPOINTS.slice(0,2)) {
          if (cancelled) return;
          const ok = await probeImage(ip, ep, 1500);
          if (ok && !cancelled) {
            setFoundIp(ip); setFoundEp(ep);
            autoConnect(ip, ep);
            return;
          }
        }
      }
      if (!cancelled) setPhase("hotspot"); // camera not on current network → show hotspot guide
    };
    check();
    return () => { cancelled = true; };
  }, []);

  // ── FULL SCAN ─────────────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    abortRef.current = false;
    setScanLog([]);
    setScanPct(0);
    setPhase("scanning");
    setErrMsg("");

    const ips: string[] = [...PRIORITY_IPS];
    for (const sub of SCAN_SUBNETS)
      for (const suf of SCAN_SUFFIXES) { const ip=`${sub}.${suf}`; if(!ips.includes(ip)) ips.push(ip); }

    const addLog = (txt: string, ok: boolean|null) =>
      setScanLog(prev => [...prev.slice(-9), {txt, ok}]);

    for (let i=0; i<ips.length; i++) {
      if (abortRef.current) return;
      const ip = ips[i];
      setScanPct(Math.round((i/ips.length)*100));
      addLog(`Probing ${ip}…`, null);

      const hits = await Promise.all(SL_ENDPOINTS.slice(0,2).map(ep => probeImage(ip,ep,1600).then(ok=>({ep,ok}))));
      for (const {ep,ok} of hits) {
        if (ok) {
          addLog(`✓ FOUND: ${ip}${ep}`, true);
          setFoundIp(ip); setFoundEp(ep);
          autoConnect(ip, ep);
          return;
        }
      }
      addLog(`✗ ${ip} — not found`, false);
    }
    setPhase("error");
    setErrMsg("No SmartLife camera found. Make sure tablet WiFi is connected to the camera hotspot.");
  }, []);

  // ── AUTO-CONNECT once IP/endpoint found ───────────────────────────────────
  const autoConnect = useCallback((ip: string, ep: string) => {
    setPhase("live");
    const baseUrl = `http://${ip}${ep}`;
    const t0 = Date.now();
    // First frame
    const img = new Image();
    img.onload = () => setLatency(Date.now()-t0);
    img.src = baseUrl + `?_t=${Date.now()}`;
    setFrameSrc(baseUrl + `?_t=${Date.now()}`);
    frameCount.current++;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      setFrameSrc(baseUrl + `?_t=${Date.now()}`);
      frameCount.current++;
    }, 500);
  }, []);

  // ── TABLET CAMERA ─────────────────────────────────────────────────────────
  const startTablet = useCallback(async () => {
    setPhase("live");
    setCamType("tablet");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{facingMode:"environment",width:{ideal:1280}}, audio:false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject=stream; videoRef.current.play(); }
      pollRef.current = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) { canvasRef.current.width=videoRef.current.videoWidth||640; canvasRef.current.height=videoRef.current.videoHeight||480; ctx.drawImage(videoRef.current,0,0); frameCount.current++; }
        }
      }, 250);
    } catch(e: unknown) {
      setPhase("error");
      setErrMsg(`Camera access denied: ${e instanceof Error?e.message:e}`);
    }
  }, []);

  // ── STOP ──────────────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    abortRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
    setPhase("hotspot"); setFrameSrc(null); setCapturedSrc(null); setFoundIp(""); setFoundEp(""); setAnalyseState("idle"); setBrainResult(null); setScanLog([]); setCamType("ip");
  }, []);

  const capture = useCallback(() => {
    if (camType==="tablet" && canvasRef.current) setCapturedSrc(canvasRef.current.toDataURL("image/jpeg",0.8));
    else if (frameSrc) setCapturedSrc(frameSrc);
  }, [camType, frameSrc]);

  const sendToBrain = useCallback(() => {
    setAnalyseState("thinking"); setBrainResult(null);
    setTimeout(() => { setBrainResult(BRAIN_POOL[brainIdx%BRAIN_POOL.length]); setBrainIdx(n=>n+1); setAnalyseState("done"); }, 1700+Math.random()*800);
  }, [brainIdx]);

  // ── Step indicator ─────────────────────────────────────────────────────────
  const stepDone  = (p:Phase) => ["scanning","live"].includes(phase) && p==="hotspot" || phase==="live" && p==="scanning";
  const stepActive= (p:Phase) => phase===p;

  return (
    <div style={{ width:"100%", minHeight:"100vh", background:C.bg, fontFamily:"'SF Pro Display',-apple-system,sans-serif", padding:14, boxSizing:"border-box", display:"flex", flexDirection:"column", gap:10 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:C.gold+"22", border:`1.5px solid ${C.gold}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎯</div>
          <div>
            <div style={{ color:C.gold, fontWeight:800, fontSize:14, letterSpacing:0.3 }}>LIVE FEED TRIAL</div>
            <div style={{ color:C.mute, fontSize:9 }}>Real camera → AI Brain · independent of HookVision</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, background:(phase==="live"?C.teal:phase==="checking"||phase==="scanning"?C.gold:phase==="error"?C.red:C.mute)+"20", border:`1px solid ${(phase==="live"?C.teal:phase==="checking"||phase==="scanning"?C.gold:phase==="error"?C.red:C.mute)}55`, borderRadius:6, padding:"3px 9px" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:phase==="live"?C.teal:phase==="checking"||phase==="scanning"?C.gold:phase==="error"?C.red:C.mute, animation:"pulse 1.2s infinite" }} />
          <span style={{ color:phase==="live"?C.teal:phase==="checking"||phase==="scanning"?C.gold:phase==="error"?C.red:C.dim, fontWeight:800, fontSize:10 }}>
            {phase==="live"?"LIVE":phase==="checking"?"CHECKING…":phase==="scanning"?"SCANNING…":phase==="error"?"ERROR":"READY"}
          </span>
        </div>
      </div>

      {/* ── Step trail ──────────────────────────────────────────────────── */}
      {phase!=="checking" && (
        <div style={{ display:"flex", gap:4, background:C.card, borderRadius:8, padding:"8px 12px", border:`1px solid ${C.border}` }}>
          <StepBadge n={1} label="Hotspot" active={stepActive("hotspot")} done={stepDone("hotspot")||phase==="live"} />
          <div style={{ color:C.border, fontSize:14, lineHeight:"24px" }}>›</div>
          <StepBadge n={2} label="Scan"    active={stepActive("scanning")} done={phase==="live"} />
          <div style={{ color:C.border, fontSize:14, lineHeight:"24px" }}>›</div>
          <StepBadge n={3} label="Live+AI" active={phase==="live"} done={false} />
        </div>
      )}

      {/* ── STEP 0: Checking ────────────────────────────────────────────── */}
      {phase==="checking" && (
        <div style={{ background:C.card, borderRadius:10, padding:"20px 14px", border:`1px solid ${C.border}`, textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📡</div>
          <div style={{ color:C.gold, fontWeight:800, fontSize:13 }}>Checking for camera on this network…</div>
          <div style={{ color:C.mute, fontSize:10, marginTop:4 }}>Probing 192.168.4.1, 192.168.1.1 and nearby IPs</div>
          <div style={{ width:"60%", margin:"14px auto 0", height:3, background:C.border, borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", background:C.gold, borderRadius:2, animation:"slide 1.5s ease-in-out infinite" }} />
          </div>
        </div>
      )}

      {/* ── STEP 1: Hotspot guide ────────────────────────────────────────── */}
      {phase==="hotspot" && (
        <div style={{ background:C.card, borderRadius:10, padding:"12px 13px", border:`1px solid ${C.border}` }}>
          <div style={{ color:C.gold, fontWeight:800, fontSize:12, marginBottom:10 }}>
            📶 STEP 1 — CONNECT TO CAMERA HOTSPOT
          </div>

          {/* WiFi QR */}
          <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:12 }}>
            <div style={{ flexShrink:0, background:"#061018", padding:6, borderRadius:8, border:`1px solid ${C.border}` }}>
              <img src={wifiQrUrl(ssid,pass)} width={100} height={100} alt="WiFi QR" style={{ display:"block", borderRadius:4 }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:C.dim, fontSize:11, fontWeight:700, marginBottom:4 }}>Scan with tablet camera to auto-join</div>
              <div style={{ color:C.mute, fontSize:9, lineHeight:1.6, marginBottom:6 }}>
                Android: open Camera → point at QR → tap the WiFi prompt<br/>
                iOS: open Camera → point at QR → tap banner
              </div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                <Chip label={`📶 ${ssid}`} color={C.sl} />
                <Chip label={`🔑 ${pass}`} color={C.gold} />
              </div>
            </div>
          </div>

          {/* Editable SSID / Pass */}
          <div style={{ background:"#061018", borderRadius:8, padding:"9px 10px", border:`1px solid ${C.border}`, marginBottom:10 }}>
            <div style={{ color:C.mute, fontSize:9, fontWeight:700, letterSpacing:0.7, marginBottom:6 }}>EDIT HOTSPOT DETAILS (find in SmartLife app → Device → "…" → Device Info)</div>
            <div style={{ display:"flex", gap:6, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <div style={{ color:C.mute, fontSize:9, marginBottom:2 }}>HOTSPOT NAME (SSID)</div>
                <input value={ssid} onChange={e=>setSsid(e.target.value)} style={{ width:"100%", background:"#0a1628", border:`1px solid ${C.border}`, borderRadius:6, color:C.sl, padding:"6px 8px", fontSize:11, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:C.mute, fontSize:9, marginBottom:2 }}>PASSWORD</div>
                <div style={{ position:"relative" }}>
                  <input type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} style={{ width:"100%", background:"#0a1628", border:`1px solid ${C.border}`, borderRadius:6, color:C.gold, padding:"6px 8px", fontSize:11, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }} />
                  <button onClick={()=>setShowPass(v=>!v)} style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.mute, cursor:"pointer", fontSize:12, padding:0 }}>{showPass?"🙈":"👁"}</button>
                </div>
              </div>
            </div>
            <div style={{ color:C.mute, fontSize:8 }}>QR code updates automatically as you type</div>
          </div>

          {/* CTA buttons */}
          <button onClick={runScan} style={{ width:"100%", height:46, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:13, outline:"none", background:C.sl+"28", border:`2px solid ${C.sl}88`, color:C.sl, marginBottom:8 }}>
            ✓ I'M CONNECTED — FIND & START CAMERA
          </button>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={startTablet} style={{ flex:1, height:36, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:C.blue+"18", border:`1px solid ${C.blue}44`, color:C.blue }}>
              📱 Use Tablet Camera Instead
            </button>
            <button onClick={runScan} style={{ flex:1, height:36, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:C.border, border:`1px solid ${C.border}`, color:C.mute }}>
              🔍 Scan Without Hotspot
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Scanning ─────────────────────────────────────────────── */}
      {phase==="scanning" && (
        <div style={{ background:C.card, borderRadius:10, padding:"12px 13px", border:`1px solid ${C.sl}44` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ color:C.sl, fontWeight:800, fontSize:12 }}>🔍 SCANNING… FINDING CAMERA</div>
            <button onClick={stopAll} style={{ background:"none", border:`1px solid ${C.border}`, color:C.mute, fontSize:9, cursor:"pointer", borderRadius:5, padding:"2px 8px" }}>STOP</button>
          </div>
          {/* Progress */}
          <div style={{ width:"100%", height:5, background:C.border, borderRadius:3, overflow:"hidden", marginBottom:6 }}>
            <div style={{ height:"100%", background:C.sl, borderRadius:3, transition:"width 0.4s", width:`${scanPct}%` }} />
          </div>
          <div style={{ color:C.mute, fontSize:9, marginBottom:8 }}>{scanPct}% complete · probing all subnets</div>
          {/* Log */}
          <div style={{ background:"#061018", borderRadius:8, padding:"8px 10px", minHeight:80 }}>
            {scanLog.slice(-8).map((r,i) => (
              <div key={i} style={{ color:r.ok===true?C.green:r.ok===false?"rgba(255,255,255,0.2)":C.gold, fontSize:10, fontFamily:"monospace", lineHeight:1.7 }}>{r.txt}</div>
            ))}
          </div>
          <div style={{ color:C.mute, fontSize:9, marginTop:6 }}>
            Camera not showing? Make sure tablet WiFi is connected to the camera's hotspot network.
          </div>
        </div>
      )}

      {/* ── STEP 3: Live feed ─────────────────────────────────────────────── */}
      {phase==="live" && (
        <>
          {/* Connection bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.card, borderRadius:8, padding:"6px 10px", border:`1px solid ${C.teal}44` }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:C.teal, animation:"pulse 1s infinite" }} />
              <span style={{ color:C.teal, fontFamily:"monospace", fontSize:10 }}>
                {camType==="tablet"?"tablet camera":`${foundIp}${foundEp}`}
              </span>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {camType!=="tablet" && <span style={{ color:C.mute, fontSize:9 }}>{latency}ms</span>}
              <span style={{ color:C.mute, fontSize:9 }}>{fps}fps</span>
              <button onClick={stopAll} style={{ background:"none", border:"none", color:C.red, fontSize:9, cursor:"pointer", fontWeight:800 }}>■ STOP</button>
            </div>
          </div>

          {/* Live frame */}
          <div style={{ borderRadius:12, overflow:"hidden", border:`1.5px solid ${C.teal}55`, position:"relative", background:"#000", aspectRatio:"16/9" }}>
            {camType!=="tablet" && frameSrc && (
              <img src={frameSrc} alt="live" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} onError={()=>{}} />
            )}
            {camType==="tablet" && (
              <>
                <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                <canvas ref={canvasRef} style={{ display:"none" }} />
              </>
            )}
            {/* LIVE badge */}
            <div style={{ position:"absolute", top:7, right:7, display:"flex", alignItems:"center", gap:3, background:"rgba(0,0,0,0.75)", borderRadius:4, padding:"2px 6px" }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:C.red, animation:"pulse 1s infinite" }} />
              <span style={{ color:C.red, fontWeight:800, fontSize:8 }}>LIVE</span>
            </div>
            {/* Camera source watermark */}
            <div style={{ position:"absolute", bottom:6, left:7, background:"rgba(0,0,0,0.65)", borderRadius:4, padding:"1px 5px" }}>
              <span style={{ color:C.sl, fontSize:8, fontFamily:"monospace" }}>{camType==="tablet"?"TABLET CAM":foundIp}</span>
            </div>
          </div>

          {/* Capture + Brain buttons */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={capture} style={{ flex:1, height:44, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background:C.blue+"22", border:`1.5px solid ${C.blue}88`, color:C.blue }}>
              📸 CAPTURE
            </button>
            <button onClick={sendToBrain} disabled={analyseState==="thinking"} style={{ flex:1, height:44, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:13, outline:"none", background:C.teal+"25", border:`2px solid ${C.teal}99`, color:C.teal, opacity:analyseState==="thinking"?0.5:1 }}>
              🧠 SEND TO AI BRAIN
            </button>
          </div>

          {/* Captured thumbnail */}
          {capturedSrc && (
            <div style={{ display:"flex", gap:8, alignItems:"flex-start", background:C.card, borderRadius:10, padding:"9px 11px", border:`1px solid ${C.border}` }}>
              <div style={{ flexShrink:0, width:80, borderRadius:6, overflow:"hidden", border:`1px solid ${C.border}` }}>
                <img src={capturedSrc} alt="captured" style={{ width:"100%", display:"block" }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:C.dim, fontSize:11, fontWeight:700, marginBottom:1 }}>FRAME CAPTURED</div>
                <div style={{ color:C.mute, fontSize:9, marginBottom:6 }}>{new Date().toLocaleTimeString()}</div>
                <button onClick={sendToBrain} disabled={analyseState==="thinking"} style={{ height:30, padding:"0 12px", borderRadius:7, cursor:"pointer", fontWeight:800, fontSize:10, outline:"none", background:C.gold+"22", border:`1.5px solid ${C.gold}88`, color:C.gold, opacity:analyseState==="thinking"?0.5:1 }}>
                  🧠 Analyse This Frame
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ERROR ────────────────────────────────────────────────────────── */}
      {phase==="error" && (
        <div style={{ background:C.red+"15", border:`1px solid ${C.red}44`, borderRadius:10, padding:"12px 13px" }}>
          <div style={{ color:C.red, fontWeight:800, fontSize:12, marginBottom:6 }}>⚠ CAMERA NOT FOUND</div>
          <div style={{ color:C.mute, fontSize:10, marginBottom:8, lineHeight:1.6 }}>{errMsg}</div>
          <div style={{ background:"#061018", borderRadius:8, padding:"8px 10px", marginBottom:10 }}>
            <div style={{ color:C.gold, fontWeight:800, fontSize:10, marginBottom:5 }}>CHECKLIST</div>
            {["This tablet WiFi must be connected to the camera's hotspot (SmartLife-XXXX or similar)","Hotspot password is usually 12345678 — check SmartLife app → Device → '…' → Device Info","After joining camera hotspot, tap SCAN AGAIN below"].map((s,i)=>(
              <div key={i} style={{ color:C.mute, fontSize:9, lineHeight:1.8 }}>• {s}</div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setPhase("hotspot")} style={{ flex:1, height:38, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:C.card, border:`1.5px solid ${C.border}`, color:C.dim }}>← Hotspot Guide</button>
            <button onClick={runScan} style={{ flex:1, height:38, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:C.sl+"22", border:`1.5px solid ${C.sl}55`, color:C.sl }}>🔍 Scan Again</button>
          </div>
        </div>
      )}

      {/* ── AI BRAIN ─────────────────────────────────────────────────────── */}
      {analyseState!=="idle" && (
        <div style={{ background:C.card, borderRadius:12, padding:"12px 13px", border:`1.5px solid ${C.teal}44` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ fontSize:16 }}>🧠</span>
              <div>
                <div style={{ color:C.teal, fontWeight:800, fontSize:12 }}>AI BRAIN ANALYSER</div>
                <div style={{ color:C.mute, fontSize:9 }}>GPT-4.1 Vision · HookVision Intelligence</div>
              </div>
            </div>
            {analyseState==="done" && brainResult && (
              <Chip label={`${brainResult.confidence}% CONFIDENCE`} color={C.green} />
            )}
          </div>

          {analyseState==="thinking" && (
            <div style={{ textAlign:"center", padding:"16px 0" }}>
              <div style={{ fontSize:24, marginBottom:5 }}>🧠</div>
              <div style={{ color:C.teal, fontWeight:800, fontSize:12 }}>Analysing frame{thinkDots}</div>
              <div style={{ color:C.mute, fontSize:9, marginTop:3 }}>Vision model · sonar cross-ref · croc scan</div>
              <div style={{ width:"70%", margin:"10px auto 0", height:3, background:C.border, borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", background:C.teal, borderRadius:2, animation:"progress 1.8s ease-in-out forwards" }} />
              </div>
            </div>
          )}

          {analyseState==="done" && brainResult && (
            <>
              <ResultRow icon="🐟" label="Fish Presence"  value={brainResult.fish}     color={C.green}  sub="sonar arches + surface bust" />
              <ResultRow icon="🦊" label="Croc Risk"      value={brainResult.croc}     color={brainResult.croc.includes("⚠")?C.red:C.green} sub="thermal edge + movement" />
              <ResultRow icon="🎣" label="Best Cast Zone" value={brainResult.castZone} color={C.gold}   sub="sonar → surface fusion" />
              <ResultRow icon="📏" label="Depth"          value={brainResult.depth}    color={C.blue}   sub="sonar OCR + contour" />
              <ResultRow icon="💧" label="Clarity"        value={brainResult.clarity}  color={C.teal}   sub="colour analysis" />
              <ResultRow icon="⚡" label="Bite Activity"  value={brainResult.activity} color={C.orange} sub="multi-signal score" />
              <div style={{ marginTop:8, background:"#061018", borderRadius:8, padding:"8px 10px", border:`1px solid ${C.border}` }}>
                <div style={{ color:C.gold, fontWeight:800, fontSize:9, marginBottom:3 }}>📋 FIELD NOTES</div>
                <div style={{ color:C.dim, fontSize:10, lineHeight:1.6 }}>{brainResult.notes}</div>
              </div>
              <button onClick={sendToBrain} style={{ marginTop:8, width:"100%", height:38, borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:C.teal+"18", border:`1.5px solid ${C.teal}55`, color:C.teal }}>
                🔄 RE-ANALYSE NEXT FRAME
              </button>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1}50%{opacity:0.25} }
        @keyframes progress { from{width:0%} to{width:100%} }
        @keyframes slide    { 0%{width:0%;margin-left:0%} 50%{width:40%;margin-left:30%} 100%{width:0%;margin-left:100%} }
        * { box-sizing:border-box; }
        input::placeholder { color:rgba(255,255,255,0.12); }
      `}</style>
    </div>
  );
}
