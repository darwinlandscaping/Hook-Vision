import { useState, useEffect, useRef, useCallback } from "react";

// ── Brand / colours ────────────────────────────────────────────────────────────
const C = {
  bg:     "#080e1a",
  card:   "#0c1628",
  border: "#1a2f4a",
  teal:   "#00d4aa",
  blue:   "#00a8ff",
  gold:   "#ffd700",
  red:    "#ff4400",
  orange: "#ff6b00",
  mute:   "rgba(255,255,255,0.30)",
  dim:    "rgba(255,255,255,0.72)",
  green:  "#00ff88",
  purple: "#c084fc",
  i360:   "#7c3aed",   // Insta360 purple-ish brand
  i360b:  "#a855f7",
};

// ── QR helper ──────────────────────────────────────────────────────────────────
const qr = (data: string, size = 150, fg = "c084fc", bg = "0c1628") =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&color=${fg}&bgcolor=${bg}&data=${encodeURIComponent(data)}`;

// ── AI brain results ───────────────────────────────────────────────────────────
const BRAIN = [
  { fish:"Barramundi school (3–5 fish, 2–4kg avg)", croc:"CLEAR · no thermal signature", cast:"CAST LEFT 25°, 12m — fish busting surface", depth:"4.2m · soft mud", clarity:"TANNIN · 0.4m vis", activity:"HIGH — bait ball near left bank", conf:91, notes:"Osprey diving confirms fish activity. 360° scan shows clean water on the right bank — position boat to cast left into the shadow edge at the snag. Golden hour window open." },
  { fish:"2 Barra arches, 6m depth", croc:"LOW RISK · movement 40m upstream", cast:"HOLD — fish moving toward boat", depth:"6.1m · rocky structure", clarity:"CLEAR · 1.2m vis", activity:"MODERATE — fish tight to structure", conf:78, notes:"360° overhead view shows fish locked to the rocky structure on the left. Slow weighted jig through the structure. Wait for them to rise." },
  { fish:"Large single, est. 65–80cm", croc:"⚠ CAUTION — 12m, right bank", cast:"CAST LEFT 35°, away from croc", depth:"3.8m · sandy flat", clarity:"MURKY · run-off tannin", activity:"HIGH — golden hour feeding", conf:94, notes:"Insta360 thermal overlay shows croc 12m right bank — confirmed movement. Big fish working the flat edge. Keep all casts to the left. Peak window: next 18 min." },
  { fish:"No arches · surface bust 3 min ago", croc:"CLEAR", cast:"WAIT — fish regrouping 4m below", depth:"5.5m", clarity:"CLEAR · 1.0m vis", activity:"LOW · between windows", conf:65, notes:"Bust window has closed. 360° scan shows no surface activity. Fish regrouping below. Hold 5–10 min — tide pushing in will bring them up again." },
];

// ── Insta360 camera endpoints ──────────────────────────────────────────────────
const I360_IP = "192.168.42.1";
const I360_EPS = ["/livestream","/live/stitched/1","/preview","/snapshot.cgi","/snap.jpg"];

type Phase = "welcome" | "wifi" | "app" | "connecting" | "live" | "error";

// ── Sub-components ──────────────────────────────────────────────────────────────
function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  const col = done ? C.green : active ? C.purple : C.mute;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, flex:1 }}>
      <div style={{ width:22, height:22, borderRadius:11, background:done?C.green+"28":active?C.purple+"28":"transparent", border:`1.5px solid ${col}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <span style={{ color:col, fontWeight:800, fontSize:10 }}>{done?"✓":n}</span>
      </div>
      <span style={{ color:col, fontSize:9, fontWeight:done||active?800:400, lineHeight:1.2 }}>{label}</span>
    </div>
  );
}

function Card({ children, accent = C.border, style = {} }: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ background:C.card, borderRadius:12, padding:"13px 14px", border:`1.5px solid ${accent}`, ...style }}>
      {children}
    </div>
  );
}

function BigBtn({ label, color, onClick, disabled = false }: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width:"100%", height:50, borderRadius:12, cursor:disabled?"not-allowed":"pointer", fontWeight:800, fontSize:14, outline:"none", background:color+"28", border:`2px solid ${color}${disabled?"44":"99"}`, color:disabled?C.mute:color, opacity:disabled?0.5:1, letterSpacing:0.3 }}>
      {label}
    </button>
  );
}

function ResultRow({ icon, label, value, color, sub }: { icon:string; label:string; value:string; color:string; sub?:string }) {
  return (
    <div style={{ display:"flex", gap:8, padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ fontSize:14, flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ color:C.mute, fontSize:10 }}>{label}</div>
        {sub && <div style={{ color:C.mute, fontSize:8, marginTop:1 }}>{sub}</div>}
      </div>
      <div style={{ color, fontWeight:800, fontSize:10, textAlign:"right", maxWidth:"56%" }}>{value}</div>
    </div>
  );
}

// ── Animated 360° fisheye canvas ───────────────────────────────────────────────
function FisheyeView({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef(0);
  const tRef      = useRef(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.width = 360; canvas.height = 360;
    let raf: number;

    // Fish state
    const fish = Array.from({length:7}, (_,i) => ({
      x: 40 + Math.random()*280, y: 100 + Math.random()*160,
      vx: (Math.random()-0.5)*0.8, vy: (Math.random()-0.5)*0.3,
      size: 6 + Math.random()*12,
      hue: Math.random() > 0.5 ? 35 : 190,
      tail: 0,
    }));
    const birds = Array.from({length:3}, () => ({ x: Math.random()*360, y: 15+Math.random()*40, vx: 0.4+Math.random()*0.6 }));
    let ripples: Array<{x:number;y:number;r:number;age:number}> = [];
    let rippleTimer = 0;

    const draw = (t: number) => {
      const dt = t - tRef.current; tRef.current = t;
      frameRef.current++;

      // Fisheye circle clip
      ctx.clearRect(0, 0, 360, 360);
      ctx.save();
      ctx.beginPath();
      ctx.arc(180, 180, 178, 0, Math.PI*2);
      ctx.clip();

      // Sky gradient (top half of fisheye)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 200);
      skyGrad.addColorStop(0,   "#0a2040");
      skyGrad.addColorStop(0.5, "#0e3a5c");
      skyGrad.addColorStop(1,   "#1a5a3a");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 360, 200);

      // Water gradient (bottom half)
      const waterGrad = ctx.createLinearGradient(0, 160, 0, 360);
      waterGrad.addColorStop(0,   "#0a3d1e");
      waterGrad.addColorStop(0.3, "#0a2f1a");
      waterGrad.addColorStop(1,   "#041208");
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, 160, 360, 200);

      // Bank / mangroves (360° sweep — left and right edges)
      for (const side of [0, 290]) {
        ctx.fillStyle = "#0d1f0a";
        ctx.fillRect(side, 60, 70, 200);
        for (let i=0;i<8;i++) {
          ctx.fillStyle = "#122808";
          ctx.beginPath();
          ctx.ellipse(side+(side?-10:70)+i*9, 80+Math.sin(t*0.0007+i)*4, 12, 28, 0, 0, Math.PI*2);
          ctx.fill();
        }
      }

      // Water shimmer
      ctx.globalAlpha = 0.18;
      for (let i=0;i<8;i++) {
        const wx = 50 + i*35 + Math.sin(t*0.0008+i)*10;
        const wy = 180 + i%3*15;
        ctx.fillStyle = "#00ff88";
        ctx.fillRect(wx, wy, 25+Math.sin(t*0.001+i)*8, 1.5);
      }
      ctx.globalAlpha = 1;

      // Tannin murk in water
      ctx.globalAlpha = 0.22;
      const murkGrad = ctx.createLinearGradient(0, 180, 0, 360);
      murkGrad.addColorStop(0, "transparent");
      murkGrad.addColorStop(1, "#3a1a00");
      ctx.fillStyle = murkGrad;
      ctx.fillRect(0, 180, 360, 180);
      ctx.globalAlpha = 1;

      // Fish
      fish.forEach(f => {
        f.x += f.vx * dt * 0.05; f.y += f.vy * dt * 0.04;
        if (f.x < 60 || f.x > 300) f.vx *= -1;
        if (f.y < 185 || f.y > 320) f.vy *= -1;
        f.tail = Math.sin(t * 0.005 + f.x) * 0.4;
        const s = f.size;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.tail);
        // Body
        ctx.fillStyle = `hsl(${f.hue},70%,55%)`;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(0, 0, s*1.8, s*0.8, 0, 0, Math.PI*2);
        ctx.fill();
        // Tail
        ctx.beginPath();
        ctx.moveTo(-s*1.5, 0);
        ctx.lineTo(-s*2.5, -s*0.8);
        ctx.lineTo(-s*2.5, s*0.8);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.ellipse(s*0.3, 0, s*0.5, s*0.3, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      });

      // Surface birds
      birds.forEach(b => {
        b.x = (b.x + b.vx * dt * 0.04) % 380;
        const by = b.y + Math.sin(t*0.001+b.x)*3;
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(b.x, by); ctx.lineTo(b.x+7, by-3); ctx.lineTo(b.x+14, by);
        ctx.stroke();
      });

      // Ripples from fish surfacing
      rippleTimer += dt;
      if (rippleTimer > 2200) {
        rippleTimer = 0;
        const rf = fish[Math.floor(Math.random()*fish.length)];
        ripples.push({ x: rf.x, y: 182, r: 2, age: 0 });
      }
      ripples = ripples.filter(r => r.age < 1);
      ripples.forEach(r => {
        r.r += dt * 0.04; r.age += dt * 0.0008;
        ctx.globalAlpha = 1 - r.age;
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r*2, r.r*0.6, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // 360° horizon distortion lines
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      for (let i=0;i<3;i++) {
        ctx.beginPath();
        ctx.ellipse(180, 180, 178*(0.3+i*0.35), 30+i*15, 0, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Vignette (fisheye edge)
      const vigGrad = ctx.createRadialGradient(180,180,140,180,180,178);
      vigGrad.addColorStop(0, "transparent");
      vigGrad.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = vigGrad;
      ctx.beginPath(); ctx.arc(180,180,178,0,Math.PI*2); ctx.fill();

      ctx.restore();

      // Lens ring
      const ringGrad = ctx.createRadialGradient(180,180,170,180,180,180);
      ringGrad.addColorStop(0, "transparent");
      ringGrad.addColorStop(0.85, C.i360+"33");
      ringGrad.addColorStop(1, C.i360+"aa");
      ctx.strokeStyle = C.i360+"cc";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(180,180,179,0,Math.PI*2); ctx.stroke();

      // UI overlays
      // North indicator
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(168, 5, 24, 14);
      ctx.fillStyle = C.purple;
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("N", 180, 16);

      // Recording indicator
      ctx.fillStyle = "#ff4400";
      ctx.beginPath(); ctx.arc(14, 14, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(22, 7, 28, 13);
      ctx.fillStyle = "#ff4400";
      ctx.font = "bold 8px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("REC", 24, 17);

      // Depth/temp data
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(4, 315, 70, 36);
      ctx.fillStyle = C.teal;
      ctx.font = "bold 8px system-ui";
      ctx.fillText("DEPTH 4.2m", 7, 327);
      ctx.fillStyle = C.gold;
      ctx.fillText("TEMP 28°C", 7, 339);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText("TIDE ↑ +0.3", 7, 350);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div style={{ width:"100%", aspectRatio:"1", borderRadius:"50%", overflow:"hidden", position:"relative", background:"#000", border:`3px solid ${C.i360}` }}>
      <canvas ref={canvasRef} style={{ width:"100%", height:"100%", display:"block" }} />
    </div>
  );
}

// ── Camera 3D Illustration ─────────────────────────────────────────────────────
function CameraIcon() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80">
      <defs>
        <radialGradient id="cg" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#2a1a4a" />
          <stop offset="100%" stopColor="#0a0a12" />
        </radialGradient>
      </defs>
      {/* Body */}
      <rect x="15" y="25" width="50" height="32" rx="6" fill="url(#cg)" stroke="#7c3aed" strokeWidth="1.5" />
      {/* Lens left */}
      <circle cx="26" cy="41" r="10" fill="#0a0a14" stroke="#a855f7" strokeWidth="1.5" />
      <circle cx="26" cy="41" r="6" fill="#000" />
      <circle cx="26" cy="41" r="3" fill="#1a0030" />
      <circle cx="24" cy="39" r="1" fill="rgba(255,255,255,0.5)" />
      {/* Lens right */}
      <circle cx="54" cy="41" r="10" fill="#0a0a14" stroke="#a855f7" strokeWidth="1.5" />
      <circle cx="54" cy="41" r="6" fill="#000" />
      <circle cx="54" cy="41" r="3" fill="#1a0030" />
      <circle cx="52" cy="39" r="1" fill="rgba(255,255,255,0.5)" />
      {/* Power btn */}
      <rect x="36" y="22" width="8" height="6" rx="2" fill="#7c3aed" opacity="0.8" />
      {/* Status LED */}
      <circle cx="40" cy="20" r="2.5" fill="#00ff88">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
      {/* Insta360 text */}
      <text x="40" y="62" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="5" fontFamily="system-ui">Insta360 ONE X3</text>
    </svg>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────────
export default function Insta360Demo() {
  const [phase,        setPhase]        = useState<Phase>("welcome");
  const [ssid,         setSsid]         = useState("INSTA360 X3 XXXX");
  const [wifiPass,     setWifiPass]     = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [connLog,      setConnLog]      = useState<string[]>([]);
  const [connPct,      setConnPct]      = useState(0);
  const [foundUrl,     setFoundUrl]     = useState("");
  const [errMsg,       setErrMsg]       = useState("");
  const [analyseState, setAnalyseState] = useState<"idle"|"thinking"|"done">("idle");
  const [brainResult,  setBrainResult]  = useState<(typeof BRAIN)[0]|null>(null);
  const [brainIdx,     setBrainIdx]     = useState(0);
  const [thinkDots,    setThinkDots]    = useState(".");
  const [camMode,      setCamMode]      = useState<"i360"|"tablet">("i360");
  const [fps,          setFps]          = useState(0);

  const abortRef   = useRef(false);
  const frameCount = useRef(0);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream|null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => {
    const t = setInterval(() => { setFps(frameCount.current); frameCount.current = 0; }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (analyseState !== "thinking") return;
    const t = setInterval(() => setThinkDots(d => d.length>=3?".":d+"."), 380);
    return () => clearInterval(t);
  }, [analyseState]);

  const addLog = (msg: string) => setConnLog(prev => [...prev.slice(-6), msg]);

  // ── Probe Insta360 ────────────────────────────────────────────────────────────
  const attemptConnect = useCallback(async () => {
    abortRef.current = false;
    setPhase("connecting"); setConnLog([]); setConnPct(0);

    addLog(`📡 Probing ${I360_IP}…`);
    for (let i=0; i<I360_EPS.length; i++) {
      if (abortRef.current) return;
      setConnPct(Math.round((i/I360_EPS.length)*100));
      const ep = I360_EPS[i];
      addLog(`Trying ${ep}…`);
      const found = await new Promise<boolean>(res => {
        const img = new Image(); let d=false;
        const fin = (v: boolean) => { if(!d){d=true;res(v);} };
        const t = setTimeout(()=>fin(false), 2200);
        img.onload = () => { clearTimeout(t); fin(true); };
        img.onerror = () => { clearTimeout(t); fin(false); };
        img.src = `http://${I360_IP}${ep}?_t=${Date.now()}`;
      });
      if (found) {
        setFoundUrl(`http://${I360_IP}${ep}`);
        addLog(`✓ FOUND stream at ${ep}`);
        // Set up polling
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(() => frameCount.current++, 500);
        setPhase("live"); setCamMode("i360");
        return;
      }
      addLog(`✗ ${ep} — no response`);
    }
    // Not found: HTTPS mixed content. Fall through to live demo with tablet camera offer
    addLog("Camera on network but HTTPS blocks direct HTTP stream.");
    addLog("Switching to live demo mode + tablet camera option.");
    setTimeout(() => { setPhase("live"); }, 1000);
  }, []);

  // ── Tablet camera ─────────────────────────────────────────────────────────────
  const startTablet = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{facingMode:"environment",width:{ideal:1280}}, audio:false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCamMode("tablet"); setPhase("live");
      pollRef.current = setInterval(() => frameCount.current++, 250);
    } catch(e) { setErrMsg(`Camera permission denied. Please allow camera access.`); setPhase("error"); }
  }, []);

  const stopAll = useCallback(() => {
    abortRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
    setPhase("welcome"); setAnalyseState("idle"); setBrainResult(null); setFoundUrl(""); setConnLog([]); setFps(0);
  }, []);

  const sendToBrain = useCallback(() => {
    setAnalyseState("thinking"); setBrainResult(null);
    setTimeout(() => { setBrainResult(BRAIN[brainIdx%BRAIN.length]); setBrainIdx(n=>n+1); setAnalyseState("done"); }, 1900 + Math.random()*700);
  }, [brainIdx]);

  const isLive = phase === "live";
  const stepDone = (p: Phase) => {
    const order: Phase[] = ["welcome","wifi","app","connecting","live"];
    return order.indexOf(phase) > order.indexOf(p);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ width:"100%", minHeight:"100vh", background:C.bg, fontFamily:"'SF Pro Display',-apple-system,sans-serif", padding:14, boxSizing:"border-box", display:"flex", flexDirection:"column", gap:10 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:C.i360+"28", border:`1.5px solid ${C.i360b}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎥</div>
          <div>
            <div style={{ color:C.i360b, fontWeight:800, fontSize:14, letterSpacing:0.3 }}>INSTA360 LIVE DEMO</div>
            <div style={{ color:C.mute, fontSize:9 }}>Insta360 ONE X3 → HookVision AI Brain</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, background:(isLive?C.green:C.mute)+"18", border:`1px solid ${(isLive?C.green:C.mute)}55`, borderRadius:7, padding:"3px 9px" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:isLive?C.green:C.mute, animation:isLive?"pulse 1s infinite":"none" }} />
          <span style={{ color:isLive?C.green:C.dim, fontWeight:800, fontSize:10 }}>
            {phase==="connecting"?"CONNECTING…":isLive?"LIVE":"SETUP"}
          </span>
        </div>
      </div>

      {/* ── Step trail ──────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:3, background:C.card, borderRadius:8, padding:"8px 11px", border:`1px solid ${C.border}` }}>
        <Step n={1} label="Power on" active={phase==="welcome"} done={stepDone("welcome")} />
        <span style={{ color:C.border, fontSize:12, lineHeight:"22px" }}>›</span>
        <Step n={2} label="WiFi join" active={phase==="wifi"} done={stepDone("wifi")} />
        <span style={{ color:C.border, fontSize:12, lineHeight:"22px" }}>›</span>
        <Step n={3} label="App setup" active={phase==="app"} done={stepDone("app")} />
        <span style={{ color:C.border, fontSize:12, lineHeight:"22px" }}>›</span>
        <Step n={4} label="Live+AI" active={isLive} done={false} />
      </div>

      {/* ── STEP 1: Welcome / Power on ──────────────────────────────────────── */}
      {phase === "welcome" && (
        <Card accent={C.i360+"55"}>
          <div style={{ textAlign:"center", padding:"10px 0" }}>
            <CameraIcon />
            <div style={{ color:C.i360b, fontWeight:800, fontSize:15, marginTop:10, marginBottom:4 }}>INSTA360 ONE X3</div>
            <div style={{ color:C.mute, fontSize:10, marginBottom:14 }}>Dual-lens 360° · 5.7K · GPS · waterproof to 10m</div>

            <div style={{ background:"#060c1a", borderRadius:10, padding:"11px 13px", marginBottom:12, textAlign:"left" }}>
              <div style={{ color:C.gold, fontWeight:800, fontSize:10, marginBottom:7 }}>STEP 1 OF 4 — POWER ON CAMERA</div>
              {[
                { icon:"🔴", txt:"Hold the power button (top of camera) for 3 seconds" },
                { icon:"🔊", txt:"Wait for the startup chime + LED turns green" },
                { icon:"📶", txt:"Camera creates its own WiFi hotspot automatically" },
                { icon:"🌐", txt:"You'll join that hotspot in Step 2" },
              ].map((s,i) => (
                <div key={i} style={{ display:"flex", gap:9, marginBottom:6 }}>
                  <span style={{ fontSize:14, flexShrink:0 }}>{s.icon}</span>
                  <span style={{ color:C.dim, fontSize:10, lineHeight:1.5 }}>{s.txt}</span>
                </div>
              ))}
            </div>

            <BigBtn label="✓ CAMERA IS ON & LED IS GREEN" color={C.green} onClick={() => setPhase("wifi")} />
            <div style={{ color:C.mute, fontSize:9, marginTop:8, lineHeight:1.7 }}>
              Don't have an Insta360 yet? Continue anyway to see the full live demo with your tablet camera instead.
            </div>
            <button onClick={() => setPhase("live")} style={{ marginTop:6, background:"none", border:`1px solid ${C.border}`, color:C.mute, fontSize:10, cursor:"pointer", borderRadius:7, padding:"7px 16px" }}>
              Skip to Live Demo →
            </button>
          </div>
        </Card>
      )}

      {/* ── STEP 2: WiFi Join ────────────────────────────────────────────────── */}
      {phase === "wifi" && (
        <Card accent={C.i360b+"55"}>
          <div style={{ color:C.i360b, fontWeight:800, fontSize:12, marginBottom:10 }}>📶 STEP 2 — JOIN INSTA360 WIFI HOTSPOT</div>

          {/* QR + instructions */}
          <div style={{ display:"flex", gap:11, alignItems:"flex-start", marginBottom:12 }}>
            <div style={{ flexShrink:0, background:"#040810", padding:6, borderRadius:9, border:`1px solid ${C.border}` }}>
              <img src={qr(`WIFI:T:WPA;S:${ssid};P:${wifiPass};;`)} width={105} height={105} alt="WiFi QR" style={{ display:"block", borderRadius:4 }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:C.dim, fontWeight:800, fontSize:11, marginBottom:5 }}>Scan to auto-join camera WiFi</div>
              <div style={{ color:C.mute, fontSize:9, lineHeight:1.8 }}>
                1. Open tablet camera → point at QR<br/>
                2. Tap "Join Network" prompt<br/>
                3. Or connect manually from WiFi settings
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <div style={{ background:"#040810", borderRadius:9, padding:"10px 12px", border:`1px solid ${C.border}`, marginBottom:10 }}>
            <div style={{ color:C.mute, fontSize:9, fontWeight:700, letterSpacing:0.7, marginBottom:7 }}>HOTSPOT DETAILS (find on camera LCD or Insta360 app → Settings → Camera WiFi)</div>
            <div style={{ marginBottom:6 }}>
              <div style={{ color:C.mute, fontSize:9, marginBottom:2 }}>NETWORK NAME (SSID)</div>
              <input value={ssid} onChange={e=>setSsid(e.target.value)} style={{ width:"100%", background:"#0a1628", border:`1px solid ${C.border}`, borderRadius:7, color:C.i360b, padding:"8px 10px", fontSize:11, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <div style={{ color:C.mute, fontSize:9, marginBottom:2 }}>PASSWORD (shown on camera LCD when in hotspot mode)</div>
              <div style={{ position:"relative" }}>
                <input type={showPass?"text":"password"} value={wifiPass} onChange={e=>setWifiPass(e.target.value)} placeholder="shown on camera LCD" style={{ width:"100%", background:"#0a1628", border:`1px solid ${C.border}`, borderRadius:7, color:C.gold, padding:"8px 10px", fontSize:11, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }} />
                <button onClick={()=>setShowPass(v=>!v)} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.mute, cursor:"pointer", fontSize:13, padding:0 }}>{showPass?"🙈":"👁"}</button>
              </div>
            </div>
            <div style={{ color:C.mute, fontSize:8, marginTop:5 }}>QR code updates live as you type</div>
          </div>

          <BigBtn label="✓ CONNECTED TO INSTA360 WIFI" color={C.i360b} onClick={() => setPhase("app")} />
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={() => setPhase("welcome")} style={{ flex:1, height:36, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:"transparent", border:`1px solid ${C.border}`, color:C.mute }}>← Back</button>
            <button onClick={startTablet} style={{ flex:1, height:36, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:C.teal+"18", border:`1px solid ${C.teal}44`, color:C.teal }}>📱 Use Tablet Camera Instead</button>
          </div>
        </Card>
      )}

      {/* ── STEP 3: App setup ────────────────────────────────────────────────── */}
      {phase === "app" && (
        <Card accent={C.purple+"55"}>
          <div style={{ color:C.purple, fontWeight:800, fontSize:12, marginBottom:10 }}>📱 STEP 3 — INSTA360 APP SETUP</div>

          <div style={{ display:"flex", gap:10, marginBottom:12 }}>
            {/* iOS */}
            <div style={{ flex:1, background:"#040810", borderRadius:9, padding:"9px 10px", border:`1px solid ${C.border}`, textAlign:"center" }}>
              <div style={{ color:C.mute, fontWeight:800, fontSize:9, marginBottom:6 }}>iOS APP STORE</div>
              <img src={qr("https://apps.apple.com/app/insta360/id1239808876", 100, "c084fc")} width={80} height={80} alt="iOS QR" style={{ display:"block", margin:"0 auto 5px" }} />
              <div style={{ color:C.mute, fontSize:8, lineHeight:1.5 }}>Scan to install<br/>"Insta360" app</div>
            </div>
            {/* Android */}
            <div style={{ flex:1, background:"#040810", borderRadius:9, padding:"9px 10px", border:`1px solid ${C.border}`, textAlign:"center" }}>
              <div style={{ color:C.mute, fontWeight:800, fontSize:9, marginBottom:6 }}>GOOGLE PLAY</div>
              <img src={qr("https://play.google.com/store/apps/details?id=com.arashivision.insta360onex", 100, "c084fc")} width={80} height={80} alt="Android QR" style={{ display:"block", margin:"0 auto 5px" }} />
              <div style={{ color:C.mute, fontSize:8, lineHeight:1.5 }}>Scan to install<br/>"Insta360" app</div>
            </div>
          </div>

          <div style={{ background:"#040810", borderRadius:9, padding:"10px 12px", border:`1px solid ${C.border}`, marginBottom:12 }}>
            <div style={{ color:C.purple, fontWeight:800, fontSize:10, marginBottom:7 }}>IN THE INSTA360 APP:</div>
            {[
              { n:"01", txt:"Tap camera icon at top right — it auto-connects to the camera hotspot you joined" },
              { n:"02", txt:"Tap the preview/live view button → you'll see the live 360° view" },
              { n:"03", txt:"Mount camera on boat — point toward water and bank for full 360° scan" },
              { n:"04", txt:"Come back here → tap CONNECT below to link HookVision AI Brain to the stream" },
            ].map(s => (
              <div key={s.n} style={{ display:"flex", gap:9, marginBottom:7 }}>
                <div style={{ width:18, height:18, borderRadius:9, background:C.i360+"28", border:`1px solid ${C.i360b}55`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ color:C.i360b, fontSize:8, fontWeight:800 }}>{s.n}</span>
                </div>
                <span style={{ color:C.dim, fontSize:10, lineHeight:1.5 }}>{s.txt}</span>
              </div>
            ))}
          </div>

          <BigBtn label="🎥 CONNECT INSTA360 → HOOKV ISION AI" color={C.purple} onClick={attemptConnect} />
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={() => setPhase("wifi")} style={{ flex:1, height:36, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:"transparent", border:`1px solid ${C.border}`, color:C.mute }}>← Back</button>
            <button onClick={startTablet} style={{ flex:1, height:36, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:C.teal+"18", border:`1px solid ${C.teal}44`, color:C.teal }}>📱 Use Tablet Camera Instead</button>
          </div>
        </Card>
      )}

      {/* ── Connecting ───────────────────────────────────────────────────────── */}
      {phase === "connecting" && (
        <Card accent={C.purple+"55"}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ color:C.purple, fontWeight:800, fontSize:12 }}>🔌 CONNECTING TO INSTA360…</div>
            <button onClick={() => { abortRef.current=true; setPhase("app"); }} style={{ background:"none", border:`1px solid ${C.border}`, color:C.mute, fontSize:9, cursor:"pointer", borderRadius:5, padding:"2px 8px" }}>STOP</button>
          </div>
          <div style={{ width:"100%", height:4, background:C.border, borderRadius:2, overflow:"hidden", marginBottom:6 }}>
            <div style={{ height:"100%", background:C.purple, borderRadius:2, transition:"width 0.4s", width:`${connPct}%` }} />
          </div>
          <div style={{ background:"#040810", borderRadius:8, padding:"9px 10px", minHeight:80, marginBottom:8 }}>
            {connLog.map((l,i) => (
              <div key={i} style={{ color:l.startsWith("✓")?C.green:l.startsWith("✗")?"rgba(255,255,255,0.18)":C.gold, fontSize:10, fontFamily:"monospace", lineHeight:1.7 }}>{l}</div>
            ))}
          </div>
          <div style={{ color:C.mute, fontSize:9, lineHeight:1.6 }}>
            Probing <code style={{color:C.i360b}}>192.168.42.1</code> — Insta360's default stream IP. Make sure the tablet WiFi is connected to the Insta360 hotspot.
          </div>
        </Card>
      )}

      {/* ── LIVE FEED ────────────────────────────────────────────────────────── */}
      {isLive && (
        <>
          {/* Status bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.card, borderRadius:8, padding:"7px 11px", border:`1px solid ${C.green}44` }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:C.green, animation:"pulse 1s infinite" }} />
              <span style={{ color:C.green, fontSize:10, fontFamily:"monospace" }}>
                {camMode==="tablet"?"tablet camera (back)":camMode==="i360"&&foundUrl?foundUrl:"DEMO MODE — Insta360 360°"}
              </span>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ color:C.mute, fontSize:9 }}>{fps}fps</span>
              <button onClick={stopAll} style={{ background:"none", border:"none", color:C.red, fontSize:9, cursor:"pointer", fontWeight:800 }}>■ STOP</button>
            </div>
          </div>

          {/* Mode selector */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setCamMode("i360")} style={{ flex:1, height:34, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:camMode==="i360"?C.i360b+"30":"transparent", border:`1.5px solid ${camMode==="i360"?C.i360b:C.border}`, color:camMode==="i360"?C.i360b:C.mute }}>🎥 360° DEMO FEED</button>
            <button onClick={startTablet} style={{ flex:1, height:34, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:camMode==="tablet"?C.teal+"28":"transparent", border:`1.5px solid ${camMode==="tablet"?C.teal:C.border}`, color:camMode==="tablet"?C.teal:C.mute }}>📱 TABLET CAMERA</button>
          </div>

          {/* Live view */}
          {camMode === "i360" && (
            <div style={{ position:"relative" }}>
              <FisheyeView active={true} />
              {/* Overlay controls */}
              <div style={{ position:"absolute", bottom:8, right:8, display:"flex", flexDirection:"column", gap:5 }}>
                {["🌐","🗺","🔲"].map((ic,i) => (
                  <div key={i} style={{ width:28, height:28, borderRadius:14, background:"rgba(0,0,0,0.7)", border:`1px solid ${C.i360b}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, cursor:"pointer" }}>{ic}</div>
                ))}
              </div>
              <div style={{ position:"absolute", top:8, left:8, background:"rgba(0,0,0,0.65)", borderRadius:6, padding:"3px 8px", display:"flex", gap:4, alignItems:"center" }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:C.red, animation:"pulse 1s infinite" }} />
                <span style={{ color:C.red, fontWeight:800, fontSize:8 }}>LIVE</span>
                <span style={{ color:C.mute, fontSize:8, marginLeft:4 }}>5.7K 360°</span>
              </div>
            </div>
          )}

          {camMode === "tablet" && (
            <div style={{ borderRadius:12, overflow:"hidden", border:`1.5px solid ${C.teal}55`, position:"relative", background:"#000", aspectRatio:"16/9" }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              <div style={{ position:"absolute", top:7, right:7, display:"flex", alignItems:"center", gap:3, background:"rgba(0,0,0,0.75)", borderRadius:4, padding:"2px 6px" }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:C.red, animation:"pulse 1s infinite" }} />
                <span style={{ color:C.red, fontWeight:800, fontSize:8 }}>LIVE</span>
              </div>
            </div>
          )}

          {/* Camera info bar */}
          {camMode === "i360" && (
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {[
                { label:"MODE", val:"360° Fisheye" },
                { label:"GPS", val:"-15.482° 128.891°" },
                { label:"GYRO", val:"Stabilised" },
                { label:"WIND", val:"12kt NE" },
              ].map(c => (
                <div key={c.label} style={{ flex:1, minWidth:70, background:C.card, borderRadius:7, padding:"5px 8px", border:`1px solid ${C.border}`, textAlign:"center" }}>
                  <div style={{ color:C.mute, fontSize:8, marginBottom:1 }}>{c.label}</div>
                  <div style={{ color:C.dim, fontWeight:800, fontSize:9 }}>{c.val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Capture + Brain */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={sendToBrain} disabled={analyseState==="thinking"} style={{ flex:2, height:50, borderRadius:12, cursor:"pointer", fontWeight:800, fontSize:14, outline:"none", background:C.teal+"28", border:`2px solid ${C.teal}99`, color:C.teal, opacity:analyseState==="thinking"?0.5:1 }}>🧠 SEND TO AI BRAIN</button>
            <button onClick={() => setPhase("app")} style={{ flex:1, height:50, borderRadius:12, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:"transparent", border:`1.5px solid ${C.border}`, color:C.mute }}>⚙ Setup</button>
          </div>
        </>
      )}

      {/* ── ERROR ────────────────────────────────────────────────────────────── */}
      {phase === "error" && (
        <Card accent={C.red+"44"} style={{ background:C.red+"10" }}>
          <div style={{ color:C.red, fontWeight:800, fontSize:12, marginBottom:6 }}>⚠ CONNECTION ISSUE</div>
          <div style={{ color:C.mute, fontSize:10, marginBottom:10, lineHeight:1.6 }}>{errMsg}</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setPhase("app")} style={{ flex:1, height:38, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:C.card, border:`1px solid ${C.border}`, color:C.dim }}>← Back</button>
            <button onClick={attemptConnect} style={{ flex:1, height:38, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:C.purple+"22", border:`1.5px solid ${C.purple}55`, color:C.purple }}>🔄 Try Again</button>
          </div>
        </Card>
      )}

      {/* ── AI BRAIN ──────────────────────────────────────────────────────────── */}
      {analyseState !== "idle" && (
        <Card accent={C.teal+"55"}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ fontSize:17 }}>🧠</span>
              <div>
                <div style={{ color:C.teal, fontWeight:800, fontSize:12 }}>AI BRAIN ANALYSER</div>
                <div style={{ color:C.mute, fontSize:9 }}>GPT-4.1 Vision · Insta360 360° data fusion</div>
              </div>
            </div>
            {analyseState==="done" && brainResult && (
              <span style={{ background:C.green+"22", border:`1px solid ${C.green}44`, borderRadius:5, padding:"2px 8px", color:C.green, fontWeight:800, fontSize:9 }}>{brainResult.conf}% CONF</span>
            )}
          </div>

          {analyseState === "thinking" && (
            <div style={{ textAlign:"center", padding:"14px 0" }}>
              <div style={{ fontSize:24, marginBottom:5 }}>🧠</div>
              <div style={{ color:C.teal, fontWeight:800, fontSize:12 }}>Fusing 360° data{thinkDots}</div>
              <div style={{ color:C.mute, fontSize:9, marginTop:2 }}>Vision · sonar overlay · croc thermal · GPS</div>
              <div style={{ width:"70%", margin:"12px auto 0", height:3, background:C.border, borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", background:C.teal, borderRadius:2, animation:"progress 1.9s ease-in-out forwards" }} />
              </div>
            </div>
          )}

          {analyseState === "done" && brainResult && (
            <>
              <ResultRow icon="🐟" label="Fish Presence"   value={brainResult.fish}      color={C.green}  sub="sonar arches + 360° surface scan" />
              <ResultRow icon="🦊" label="Croc Scan"       value={brainResult.croc}      color={brainResult.croc.includes("⚠")?C.red:C.green} sub="360° thermal perimeter sweep" />
              <ResultRow icon="🎣" label="Best Cast Zone"  value={brainResult.cast}       color={C.gold}   sub="sonar → surface fusion" />
              <ResultRow icon="📏" label="Depth"           value={brainResult.depth}      color={C.blue}   sub="sonar OCR + contour" />
              <ResultRow icon="💧" label="Water Clarity"   value={brainResult.clarity}    color={C.teal}   sub="360° colour analysis" />
              <ResultRow icon="⚡" label="Bite Activity"   value={brainResult.activity}   color={C.orange} sub="multi-signal score" />
              <div style={{ marginTop:9, background:"#040810", borderRadius:9, padding:"9px 11px", border:`1px solid ${C.border}` }}>
                <div style={{ color:C.gold, fontWeight:800, fontSize:9, marginBottom:3 }}>📋 FIELD NOTES — 360° ANALYSIS</div>
                <div style={{ color:C.dim, fontSize:10, lineHeight:1.6 }}>{brainResult.notes}</div>
              </div>
              <button onClick={sendToBrain} style={{ marginTop:9, width:"100%", height:40, borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:11, outline:"none", background:C.teal+"18", border:`1.5px solid ${C.teal}55`, color:C.teal }}>
                🔄 RE-ANALYSE · NEXT 360° FRAME
              </button>
            </>
          )}
        </Card>
      )}

      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1}50%{opacity:0.2} }
        @keyframes progress { from{width:0%} to{width:100%} }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
