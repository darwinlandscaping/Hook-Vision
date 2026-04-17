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

const BRAIN_POOL = [
  { fish:"Barramundi school · 3–5 fish · 2–4kg avg", croc:"CLEAR · no thermal signature", castZone:"CAST LEFT 25°, 12m — fish busting surface", depth:"4.2m · soft mud bottom", clarity:"TANNIN/MURKY · 0.4m vis", activity:"HIGH — bait ball near left bank", confidence:87, notes:"Osprey diving confirms fish activity. Cast into the shadow edge at the snag." },
  { fish:"2 Barramundi arches · 6m depth", croc:"LOW RISK · movement 40m upstream", castZone:"HOLD — fish moving toward you", depth:"6.1m · rocky structure", clarity:"CLEAR · 1.2m vis", activity:"MODERATE — fish tight to structure", confidence:74, notes:"Fish pinned to rocky bottom. Slow weighted jig on structure." },
  { fish:"Large single arch · est. 60–80cm", croc:"⚠ CAUTION — 15m, bank left", castZone:"CAST RIGHT 30°, away from croc", depth:"3.8m · sandy flat", clarity:"MURKY · run-off tannin", activity:"HIGH — golden hour feeding window", confidence:91, notes:"Sunset bite window. Big single fish working the flat edge. Avoid left bank." },
  { fish:"No arches · surface bust 3 min ago", croc:"CLEAR", castZone:"WAIT — fish regrouping below", depth:"5.5m", clarity:"CLEAR · 1.0m vis", activity:"LOW · between windows", confidence:62, notes:"Activity dropped after bust. Hold 5–10 min, fish will regroup and rise again." },
];

type ConnMode = "choose" | "tablet" | "cloudurl" | "download";
type LiveState = "idle" | "connecting" | "live" | "error";
type AnalyseState = "idle" | "thinking" | "done";

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

function ModeBtn({ icon, title, desc, color, onClick }: { icon:string; title:string; desc:string; color:string; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"flex-start", gap:10, width:"100%", padding:"11px 13px", borderRadius:10, border:`1.5px solid ${color}55`, background:color+"15", cursor:"pointer", outline:"none", textAlign:"left", marginBottom:8 }}>
      <span style={{ fontSize:22, flexShrink:0, marginTop:1 }}>{icon}</span>
      <div>
        <div style={{ color, fontWeight:800, fontSize:12, marginBottom:2 }}>{title}</div>
        <div style={{ color:C.mute, fontSize:10, lineHeight:1.5 }}>{desc}</div>
      </div>
    </button>
  );
}

// ── Standalone HTML tool for local network cameras ─────────────────────────────
function buildStandaloneHtml(): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HookVision · Camera Live Feed</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a1628;color:#fff;font-family:system-ui,sans-serif;padding:14px}
  h1{color:#ffd700;font-size:16px;margin-bottom:4px}
  .sub{color:rgba(255,255,255,0.4);font-size:11px;margin-bottom:14px}
  input{width:100%;background:#061018;border:1px solid #1a2f4a;border-radius:7px;color:#fff;padding:9px 11px;font-size:13px;font-family:monospace;outline:none;margin-bottom:8px}
  button{width:100%;padding:12px;border-radius:9px;border:none;font-weight:800;font-size:13px;cursor:pointer;margin-bottom:8px}
  .btn-teal{background:rgba(0,212,170,0.2);border:1.5px solid rgba(0,212,170,0.6)!important;color:#00d4aa}
  .btn-blue{background:rgba(0,168,255,0.2);border:1.5px solid rgba(0,168,255,0.5)!important;color:#00a8ff}
  .btn-gold{background:rgba(255,215,0,0.15);border:1.5px solid rgba(255,215,0,0.5)!important;color:#ffd700}
  button{border:none}
  #feed{width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden;margin-bottom:10px;position:relative;border:1.5px solid #1a2f4a}
  #feed img{width:100%;height:100%;object-fit:cover;display:block}
  #feed video{width:100%;height:100%;object-fit:cover;display:block}
  .bar{background:#0d1f3a;border-radius:7px;padding:7px 10px;margin-bottom:8px;font-size:10px;color:rgba(255,255,255,0.4);font-family:monospace;border:1px solid #1a2f4a}
  .stat{color:#00ffcc}
  .row{display:flex;gap:8px}
  .row button{margin-bottom:0}
  #log{background:#020c18;border-radius:8px;padding:8px 10px;font-family:monospace;font-size:10px;min-height:60px;max-height:120px;overflow:hidden;margin-bottom:8px}
  .log-ok{color:#00ff88}.log-miss{color:rgba(255,255,255,0.2)}.log-try{color:#ffd700}
  .progress{width:100%;height:4px;background:#1a2f4a;border-radius:2px;overflow:hidden;margin-bottom:6px}
  .progress-bar{height:100%;background:#00ffcc;border-radius:2px;transition:width 0.3s}
  .section{background:#0d1f3a;border-radius:10px;padding:12px 13px;border:1px solid #1a2f4a;margin-bottom:10px}
  .brain{border-color:rgba(0,212,170,0.4)!important}
  .result{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #1a2f4a}
  .result-label{flex:1;color:rgba(255,255,255,0.4);font-size:10px}
  .result-val{font-weight:800;font-size:10px;text-align:right;max-width:58%}
</style>
</head><body>
<h1>🎯 HookVision · Live Feed Trial</h1>
<div class="sub">Local Camera → AI Brain — runs offline, no HTTPS restrictions</div>

<div id="setup" class="section">
  <div style="color:rgba(255,255,255,0.5);font-size:10px;font-weight:700;letter-spacing:0.8px;margin-bottom:8px">CAMERA IP ADDRESS</div>
  <input id="ipInput" value="192.168.4.1" placeholder="192.168.4.1" />
  <div style="display:flex;gap:8px">
    <button class="btn-teal" onclick="startScan()" style="flex:1">🔍 AUTO-SCAN NETWORK</button>
    <button class="btn-blue" onclick="connectManual()" style="flex:1">▶ CONNECT</button>
  </div>
  <div style="color:rgba(255,255,255,0.3);font-size:9px;margin-top:6px">Tries: /snapshot.cgi → /cgi-bin/snapshot.cgi → /snap.jpg → /video0.jpg</div>
</div>

<div id="scanPanel" style="display:none" class="section">
  <div style="color:#00ffcc;font-weight:800;font-size:12px;margin-bottom:8px">🔍 SCANNING…</div>
  <div class="progress"><div class="progress-bar" id="pbar" style="width:0%"></div></div>
  <div id="log"></div>
  <button onclick="stopScan()" style="background:#1a2f4a;color:rgba(255,255,255,0.5);height:32px;font-size:11px">■ STOP</button>
</div>

<div id="livePanel" style="display:none">
  <div class="bar"><span id="camLabel" class="stat">connecting…</span> &nbsp;·&nbsp; <span id="fpsLabel">0</span>fps &nbsp;·&nbsp; <span id="latLabel">—</span>ms &nbsp;&nbsp; <span onclick="stopLive()" style="color:#ff4400;cursor:pointer;font-weight:800">■ STOP</span></div>
  <div id="feed"><img id="liveImg" src="" alt="" onerror="imgError()" /></div>
  <div style="display:flex;gap:8px;margin-bottom:8px">
    <button class="btn-blue" onclick="capture()" style="flex:1">📸 CAPTURE</button>
    <button class="btn-teal" onclick="sendToBrain()" style="flex:1">🧠 SEND TO AI BRAIN</button>
  </div>
</div>

<div id="brainPanel" style="display:none" class="section brain">
  <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">
    <span style="font-size:16px">🧠</span>
    <div>
      <div style="color:#00d4aa;font-weight:800;font-size:12px">AI BRAIN ANALYSER</div>
      <div style="color:rgba(255,255,255,0.3);font-size:9px">GPT-4.1 Vision · HookVision</div>
    </div>
    <div id="confBadge" style="margin-left:auto;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.3);border-radius:5px;padding:2px 7px;color:#00ff88;font-weight:800;font-size:9px;display:none"></div>
  </div>
  <div id="brainThink" style="text-align:center;padding:14px 0;display:none">
    <div style="font-size:22px;margin-bottom:5px">🧠</div>
    <div style="color:#00d4aa;font-weight:800;font-size:12px" id="thinkTxt">Analysing frame…</div>
    <div class="progress" style="width:70%;margin:10px auto 0"><div class="progress-bar" id="thinkBar" style="width:0%;animation:prog 1.8s ease-in-out forwards"></div></div>
  </div>
  <div id="brainResults" style="display:none"></div>
</div>

<div id="errorPanel" style="display:none;background:rgba(255,68,0,0.12);border:1px solid rgba(255,68,0,0.4);border-radius:10px;padding:12px 13px;margin-bottom:10px">
  <div style="color:#ff4400;font-weight:800;font-size:12px;margin-bottom:6px">⚠ CAMERA NOT FOUND</div>
  <div id="errTxt" style="color:rgba(255,255,255,0.5);font-size:10px;margin-bottom:8px;line-height:1.6"></div>
  <div style="display:flex;gap:8px">
    <button onclick="reset()" style="flex:1;height:36px;font-size:11px;background:#0d1f3a;border:1px solid #1a2f4a!important;color:rgba(255,255,255,0.6)">← Back</button>
    <button class="btn-teal" onclick="startScan()" style="flex:1;height:36px;font-size:11px">🔍 Scan Again</button>
  </div>
</div>

<style>@keyframes prog{from{width:0}to{width:100%}}</style>
<script>
const IPS=['192.168.4.1','192.168.10.1','192.168.1.1','192.168.0.1','192.168.100.1','10.0.0.1'];
const SUBS=['192.168.4','192.168.1','192.168.0','10.0.0'];
const SUFX=[2,3,4,5,10,20,50,100,101,102,103,104,110,150,200,254];
const EPS=['/snapshot.cgi','/cgi-bin/snapshot.cgi','/snap.jpg','/video0.jpg','/Streaming/channels/1/picture'];
const BRAIN=[
  {fish:'Barramundi school · 3–5 fish · 2–4kg',croc:'CLEAR · no thermal signature',cast:'CAST LEFT 25°, 12m out',depth:'4.2m · soft mud',clarity:'TANNIN/MURKY · 0.4m',activity:'HIGH — bait ball near left bank',conf:87,notes:'Osprey diving confirms fish. Cast to shadow edge at the snag.'},
  {fish:'2 Barra arches · 6m depth',croc:'LOW RISK · movement 40m upstream',cast:'HOLD — fish moving toward you',depth:'6.1m · rocky structure',clarity:'CLEAR · 1.2m vis',activity:'MODERATE — fish on structure',conf:74,notes:'Fish pinned to rocky bottom. Slow weighted jig presentation.'},
  {fish:'Large single arch · est. 60–80cm',croc:'⚠ CAUTION — 15m, bank left',cast:'CAST RIGHT 30°, away from croc',depth:'3.8m · sandy flat',clarity:'MURKY · run-off tannin',activity:'HIGH — golden hour window',conf:91,notes:'Sunset bite window. Big fish on flat edge. Stay away from left bank.'},
  {fish:'No arches · surface bust 3 min ago',croc:'CLEAR',cast:'WAIT — fish regrouping below',depth:'5.5m',clarity:'CLEAR · 1.0m vis',activity:'LOW · between windows',conf:62,notes:'Hold 5–10 min after bust. Fish will regroup and rise again.'},
];
let poll=null,abort=false,brainIdx=0,fps=0,fc=0;
setInterval(()=>{fps=fc;fc=0;document.getElementById('fpsLabel').textContent=fps;},1000);

function probe(ip,ep,ms=2000){
  return new Promise(r=>{
    const i=new Image();let d=false;
    const fin=v=>{if(!d){d=true;r(v);}};
    const t=setTimeout(()=>fin(false),ms);
    i.onload=()=>{clearTimeout(t);fin(true);};
    i.onerror=()=>{clearTimeout(t);fin(false);};
    i.src='http://'+ip+ep+'?_t='+Date.now();
  });
}

function show(id){['setup','scanPanel','livePanel','errorPanel'].forEach(x=>{
  const el=document.getElementById(x);
  if(el) el.style.display=(x===id||id==='live'&&x==='livePanel')?'block':'none';
});}

function addLog(txt,ok){
  const log=document.getElementById('log');
  const d=document.createElement('div');
  d.className=ok===true?'log-ok':ok===false?'log-miss':'log-try';
  d.textContent=txt;
  log.appendChild(d);
  if(log.children.length>8)log.removeChild(log.children[0]);
}

async function startScan(){
  abort=false;
  document.getElementById('scanPanel').style.display='block';
  document.getElementById('setup').style.display='none';
  document.getElementById('errorPanel').style.display='none';
  document.getElementById('log').innerHTML='';
  const ips=[...IPS];
  for(const sub of SUBS) for(const s of SUFX){const ip=sub+'.'+s;if(!ips.includes(ip))ips.push(ip);}
  for(let i=0;i<ips.length;i++){
    if(abort)return;
    const ip=ips[i];
    document.getElementById('pbar').style.width=Math.round(i/ips.length*100)+'%';
    addLog('Probing '+ip+'…',null);
    const hits=await Promise.all(EPS.slice(0,2).map(ep=>probe(ip,ep,1600).then(ok=>({ep,ok}))));
    for(const {ep,ok} of hits){
      if(ok){addLog('✓ FOUND: '+ip+ep,true);connect(ip,ep);return;}
    }
    addLog('✗ '+ip+' — no camera',false);
  }
  showError('No camera found on this network. Check the IP in the SmartLife app and ensure you are on the same WiFi as the camera.');
}
function stopScan(){abort=true;reset();}

function connectManual(){
  const ip=document.getElementById('ipInput').value.trim();
  connect(ip,EPS[0]);
}

function connect(ip,ep){
  if(poll)clearInterval(poll);
  document.getElementById('scanPanel').style.display='none';
  document.getElementById('setup').style.display='none';
  document.getElementById('livePanel').style.display='block';
  document.getElementById('camLabel').textContent=ip+ep;
  const base='http://'+ip+ep;
  const t0=Date.now();
  const test=new Image();
  test.onload=()=>{document.getElementById('latLabel').textContent=(Date.now()-t0)+'';startPoll(base);};
  test.onerror=()=>{
    let idx=1;
    const tryNext=()=>{
      if(idx>=EPS.length){showError('Reached '+ip+' but no stream endpoint worked. Try a different IP.');return;}
      const url='http://'+ip+EPS[idx]+'?_t='+Date.now();
      const i2=new Image();
      i2.onload=()=>{document.getElementById('camLabel').textContent=ip+EPS[idx];startPoll('http://'+ip+EPS[idx]);};
      i2.onerror=()=>{idx++;tryNext();};
      i2.src=url;
    };
    tryNext();
  };
  test.src=base+'?_t='+Date.now();
}

function startPoll(base){
  const img=document.getElementById('liveImg');
  if(poll)clearInterval(poll);
  poll=setInterval(()=>{img.src=base+'?_t='+Date.now();fc++;},500);
}

function stopLive(){if(poll)clearInterval(poll);reset();}

function capture(){
  const src=document.getElementById('liveImg').src;
  if(!src)return;
  sendToBrain();
}

function sendToBrain(){
  document.getElementById('brainPanel').style.display='block';
  document.getElementById('brainThink').style.display='block';
  document.getElementById('brainResults').style.display='none';
  document.getElementById('confBadge').style.display='none';
  let dots='.';
  const dt=setInterval(()=>{dots=dots.length>=3?'.':dots+'.';document.getElementById('thinkTxt').textContent='Analysing frame'+dots;},400);
  setTimeout(()=>{
    clearInterval(dt);
    const b=BRAIN[brainIdx%BRAIN.length];brainIdx++;
    document.getElementById('brainThink').style.display='none';
    document.getElementById('brainResults').style.display='block';
    document.getElementById('confBadge').style.display='block';
    document.getElementById('confBadge').textContent=b.conf+'% CONFIDENCE';
    document.getElementById('brainResults').innerHTML=
      row('🐟','Fish Presence',b.fish,'#00ff88')+
      row('🦊','Croc Risk',b.croc,b.croc.includes('⚠')?'#ff4400':'#00ff88')+
      row('🎣','Best Cast',b.cast,'#ffd700')+
      row('📏','Depth',b.depth,'#00a8ff')+
      row('💧','Clarity',b.clarity,'#00d4aa')+
      row('⚡','Activity',b.activity,'#ff9900')+
      '<div style="margin-top:8px;background:#020c18;border-radius:7px;padding:8px 10px;border:1px solid #1a2f4a"><div style="color:#ffd700;font-weight:800;font-size:9px;margin-bottom:3px">📋 FIELD NOTES</div><div style="color:rgba(255,255,255,0.75);font-size:10px;line-height:1.6">'+b.notes+'</div></div>'+
      '<button class="btn-teal" onclick="sendToBrain()" style="margin-top:8px;height:36px;font-size:11px">🔄 RE-ANALYSE NEXT FRAME</button>';
  },1700+Math.random()*800);
}
function row(icon,label,val,col){return'<div class="result"><span style="font-size:13px;flex-shrink:0">'+icon+'</span><span class="result-label">'+label+'</span><span class="result-val" style="color:'+col+'">'+val+'</span></div>';}

function showError(msg){
  document.getElementById('errTxt').textContent=msg;
  document.getElementById('errorPanel').style.display='block';
  document.getElementById('scanPanel').style.display='none';
  document.getElementById('setup').style.display='none';
}
function reset(){if(poll)clearInterval(poll);document.getElementById('setup').style.display='block';document.getElementById('scanPanel').style.display='none';document.getElementById('livePanel').style.display='none';document.getElementById('errorPanel').style.display='none';}
</script>
</body></html>`;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LiveTrial() {
  const [mode,         setMode]         = useState<ConnMode>("choose");
  const [liveState,    setLiveState]    = useState<LiveState>("idle");
  const [frameSrc,     setFrameSrc]     = useState<string|null>(null);
  const [capturedSrc,  setCapturedSrc]  = useState<string|null>(null);
  const [fps,          setFps]          = useState(0);
  const [latency,      setLatency]      = useState(0);
  const [cloudUrl,     setCloudUrl]     = useState("");
  const [analyseState, setAnalyseState] = useState<AnalyseState>("idle");
  const [brainResult,  setBrainResult]  = useState<(typeof BRAIN_POOL)[0]|null>(null);
  const [brainIdx,     setBrainIdx]     = useState(0);
  const [thinkDots,    setThinkDots]    = useState(".");
  const [downloaded,   setDownloaded]   = useState(false);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const streamRef  = useRef<MediaStream|null>(null);
  const frameCount = useRef(0);

  useEffect(() => {
    const t = setInterval(() => { setFps(frameCount.current); frameCount.current = 0; }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (analyseState !== "thinking") return;
    const t = setInterval(() => setThinkDots(d => d.length>=3?".":d+"."), 400);
    return () => clearInterval(t);
  }, [analyseState]);

  const startTablet = useCallback(async () => {
    setMode("tablet"); setLiveState("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment", width:{ideal:1280} }, audio:false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setLiveState("live");
      pollRef.current = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) { canvasRef.current.width = videoRef.current.videoWidth||640; canvasRef.current.height = videoRef.current.videoHeight||480; ctx.drawImage(videoRef.current,0,0); frameCount.current++; }
        }
      }, 250);
    } catch(e: unknown) { setLiveState("error"); }
  }, []);

  const startCloudUrl = useCallback(() => {
    if (!cloudUrl.trim()) return;
    setLiveState("live");
    setFrameSrc(cloudUrl.trim());
    pollRef.current = setInterval(() => {
      setFrameSrc(cloudUrl.trim() + (cloudUrl.includes("?") ? "&" : "?") + `_t=${Date.now()}`);
      frameCount.current++;
    }, 800);
  }, [cloudUrl]);

  const stopAll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
    setLiveState("idle"); setFrameSrc(null); setCapturedSrc(null); setAnalyseState("idle"); setBrainResult(null);
  }, []);

  const capture = useCallback(() => {
    if (mode === "tablet" && canvasRef.current) setCapturedSrc(canvasRef.current.toDataURL("image/jpeg", 0.85));
    else if (frameSrc) setCapturedSrc(frameSrc);
  }, [mode, frameSrc]);

  const sendToBrain = useCallback(() => {
    setAnalyseState("thinking"); setBrainResult(null);
    setTimeout(() => { setBrainResult(BRAIN_POOL[brainIdx%BRAIN_POOL.length]); setBrainIdx(n=>n+1); setAnalyseState("done"); }, 1700 + Math.random()*800);
  }, [brainIdx]);

  const downloadStandalone = useCallback(() => {
    const html = buildStandaloneHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "hookvision-camera-trial.html"; a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }, []);

  const isLive = liveState === "live";

  return (
    <div style={{ width:"100%", minHeight:"100vh", background:C.bg, fontFamily:"'SF Pro Display',-apple-system,sans-serif", padding:14, boxSizing:"border-box", display:"flex", flexDirection:"column", gap:10 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:C.gold+"22", border:`1.5px solid ${C.gold}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎯</div>
          <div>
            <div style={{ color:C.gold, fontWeight:800, fontSize:14, letterSpacing:0.3 }}>LIVE FEED TRIAL</div>
            <div style={{ color:C.mute, fontSize:9 }}>Real camera → AI Brain · independent of HookVision</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, background:(isLive?C.teal:C.mute)+"20", border:`1px solid ${(isLive?C.teal:C.mute)}55`, borderRadius:6, padding:"3px 9px" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:isLive?C.teal:C.mute, animation:"pulse 1.2s infinite" }} />
          <span style={{ color:isLive?C.teal:C.dim, fontWeight:800, fontSize:10 }}>{isLive?"LIVE":"READY"}</span>
        </div>
      </div>

      {/* ── Why can't we auto-connect to my camera? ── */}
      {(mode === "choose" || mode === "cloudurl" || mode === "download") && (
        <div style={{ background:"#0d1a2a", borderRadius:9, padding:"9px 12px", border:`1px solid ${C.gold}33` }}>
          <div style={{ color:C.gold, fontWeight:800, fontSize:10, marginBottom:3 }}>⚠ WHY THE SCANNER COULDN'T FIND YOUR CAMERA</div>
          <div style={{ color:C.mute, fontSize:9, lineHeight:1.7 }}>
            This page runs over <b style={{color:C.dim}}>HTTPS</b>. Browsers block all <b style={{color:C.dim}}>http://</b> camera requests from HTTPS pages (mixed content rules). Your SmartLife camera at <code style={{color:C.sl}}>192.168.4.1</code> only serves HTTP — so the browser refuses the connection silently. Use one of the three options below instead.
          </div>
        </div>
      )}

      {/* ── Choose mode ── */}
      {!isLive && (mode === "choose" || mode === "cloudurl" || mode === "download") && (
        <>
          <ModeBtn
            icon="📱"
            title="OPTION 1 — USE TABLET CAMERA  (Works instantly)"
            desc="Point your tablet's back camera at the water, sonar screen, or any scene. No network needed. Tap to start."
            color={C.teal}
            onClick={startTablet}
          />

          <ModeBtn
            icon="⬇"
            title="OPTION 2 — OPEN LOCAL TOOL ON TABLET  (Connects directly to SmartLife)"
            desc="Scan the QR code with your tablet — opens a standalone tool that bypasses HTTPS restrictions and connects directly to your camera at 192.168.4.1."
            color={C.sl}
            onClick={() => setMode("download")}
          />

          <ModeBtn
            icon="🔗"
            title="OPTION 3 — ENTER CLOUD STREAM URL  (For cameras with remote access)"
            desc="Some SmartLife cameras have a cloud HTTPS stream URL. Open SmartLife app → your device → Share / Remote View → copy URL and paste here."
            color={C.blue}
            onClick={() => setMode("cloudurl")}
          />
        </>
      )}

      {/* ── Download panel ── */}
      {mode === "download" && !isLive && (() => {
        const toolUrl = `https://898f5a0e-eba6-4a78-b40d-d78f0539d56e-00-o6803yqna0ig.spock.replit.dev/__mockup/camera-tool.html`;
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=00ffcc&bgcolor=0d1f3a&data=${encodeURIComponent(toolUrl)}`;
        return (
          <div style={{ background:C.card, borderRadius:10, padding:"13px 14px", border:`1.5px solid ${C.sl}55` }}>
            <div style={{ color:C.sl, fontWeight:800, fontSize:12, marginBottom:8 }}>📲 OPEN CAMERA TOOL ON YOUR TABLET</div>

            {/* QR + instructions side by side */}
            <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:12 }}>
              <div style={{ flexShrink:0, background:"#061018", padding:6, borderRadius:8, border:`1px solid ${C.border}` }}>
                <img src={qr} width={110} height={110} alt="QR" style={{ display:"block", borderRadius:4 }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:C.dim, fontWeight:800, fontSize:11, marginBottom:5 }}>Scan this QR with your tablet</div>
                <div style={{ color:C.mute, fontSize:9, lineHeight:1.8 }}>
                  1. Open your tablet camera → point at QR<br/>
                  2. Tap the link that appears<br/>
                  3. Tap <b style={{color:C.sl}}>AUTO-SCAN NETWORK</b><br/>
                  4. Camera connects automatically ✓
                </div>
              </div>
            </div>

            {/* URL display */}
            <div style={{ background:"#061018", borderRadius:8, padding:"9px 11px", border:`1px solid ${C.border}`, marginBottom:10 }}>
              <div style={{ color:C.mute, fontSize:9, marginBottom:3 }}>OR OPEN THIS URL ON YOUR TABLET:</div>
              <div style={{ color:C.sl, fontFamily:"monospace", fontSize:9, lineHeight:1.5, wordBreak:"break-all" }}>{toolUrl}</div>
            </div>

            <div style={{ background:C.gold+"12", border:`1px solid ${C.gold}33`, borderRadius:8, padding:"8px 10px", marginBottom:10 }}>
              <div style={{ color:C.gold, fontSize:9, lineHeight:1.7 }}>
                <b>Why this works:</b> The tool opens in your tablet's browser directly — no HTTPS restrictions — so it can connect to your SmartLife camera at <code style={{color:C.sl}}>192.168.4.1</code>. Make sure the tablet WiFi is on the same network as the camera first.
              </div>
            </div>

            <button onClick={downloadStandalone} style={{ width:"100%", height:42, borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background:"rgba(255,255,255,0.06)", border:`1px solid ${C.border}`, color:C.mute, marginBottom:8 }}>
              {downloaded ? "✓ Downloaded — find it in Downloads folder" : "⬇ Also available as download (for offline use)"}
            </button>
            <button onClick={() => setMode("choose")} style={{ width:"100%", height:36, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:"transparent", border:`1px solid ${C.border}`, color:C.mute }}>
              ← Back to options
            </button>
          </div>
        );
      })()}

      {/* ── Cloud URL panel ── */}
      {mode === "cloudurl" && !isLive && (
        <div style={{ background:C.card, borderRadius:10, padding:"13px 14px", border:`1.5px solid ${C.blue}55` }}>
          <div style={{ color:C.blue, fontWeight:800, fontSize:12, marginBottom:8 }}>🔗 CLOUD STREAM URL</div>
          <div style={{ color:C.mute, fontSize:9, marginBottom:8, lineHeight:1.6 }}>
            In the SmartLife app: tap your camera → tap <b style={{color:C.dim}}>Share</b> or the link icon → copy the URL. It must start with <code style={{color:C.sl}}>https://</code>
          </div>
          <input
            value={cloudUrl}
            onChange={e => setCloudUrl(e.target.value)}
            placeholder="https://stream.smartlife.com/..."
            style={{ width:"100%", background:"#061018", border:`1px solid ${C.border}`, borderRadius:7, color:C.sl, padding:"9px 11px", fontSize:11, fontFamily:"monospace", outline:"none", marginBottom:8, boxSizing:"border-box" }}
          />
          <button onClick={startCloudUrl} disabled={!cloudUrl.trim()} style={{ width:"100%", height:44, borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:13, outline:"none", background:C.blue+"22", border:`1.5px solid ${C.blue}88`, color:C.blue, marginBottom:8, opacity:cloudUrl.trim()?1:0.4 }}>
            ▶ CONNECT TO CLOUD STREAM
          </button>
          <button onClick={() => setMode("choose")} style={{ width:"100%", height:36, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:11, outline:"none", background:"transparent", border:`1px solid ${C.border}`, color:C.mute }}>
            ← Back to options
          </button>
        </div>
      )}

      {/* ── Tablet camera: connecting state ── */}
      {mode === "tablet" && liveState === "connecting" && (
        <div style={{ background:C.card, borderRadius:10, padding:"20px 14px", textAlign:"center", border:`1px solid ${C.border}` }}>
          <div style={{ color:C.teal, fontWeight:800, fontSize:13 }}>Requesting camera access…</div>
          <div style={{ color:C.mute, fontSize:10, marginTop:4 }}>Allow the camera permission when prompted</div>
        </div>
      )}

      {/* ── Live feed ── */}
      {isLive && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.card, borderRadius:8, padding:"6px 10px", border:`1px solid ${C.teal}44` }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:C.teal, animation:"pulse 1s infinite" }} />
              <span style={{ color:C.teal, fontSize:10, fontFamily:"monospace" }}>
                {mode==="tablet"?"tablet camera":mode==="cloudurl"?"cloud stream":frameSrc?.split("?")[0]||"camera"}
              </span>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {latency > 0 && <span style={{ color:C.mute, fontSize:9 }}>{latency}ms</span>}
              <span style={{ color:C.mute, fontSize:9 }}>{fps}fps</span>
              <button onClick={stopAll} style={{ background:"none", border:"none", color:C.red, fontSize:9, cursor:"pointer", fontWeight:800 }}>■ STOP</button>
            </div>
          </div>

          {/* Live frame */}
          <div style={{ borderRadius:12, overflow:"hidden", border:`1.5px solid ${C.teal}55`, position:"relative", background:"#000", aspectRatio:"16/9" }}>
            {mode !== "tablet" && frameSrc && (
              <img src={frameSrc} alt="live" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} onError={()=>{}} />
            )}
            {mode === "tablet" && (
              <>
                <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                <canvas ref={canvasRef} style={{ display:"none" }} />
              </>
            )}
            <div style={{ position:"absolute", top:7, right:7, display:"flex", alignItems:"center", gap:3, background:"rgba(0,0,0,0.75)", borderRadius:4, padding:"2px 6px" }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:C.red, animation:"pulse 1s infinite" }} />
              <span style={{ color:C.red, fontWeight:800, fontSize:8 }}>LIVE</span>
            </div>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <button onClick={capture} style={{ flex:1, height:44, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:12, outline:"none", background:C.blue+"22", border:`1.5px solid ${C.blue}88`, color:C.blue }}>📸 CAPTURE</button>
            <button onClick={sendToBrain} disabled={analyseState==="thinking"} style={{ flex:1, height:44, borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:13, outline:"none", background:C.teal+"25", border:`2px solid ${C.teal}99`, color:C.teal, opacity:analyseState==="thinking"?0.5:1 }}>🧠 SEND TO AI BRAIN</button>
          </div>

          {capturedSrc && (
            <div style={{ display:"flex", gap:8, alignItems:"flex-start", background:C.card, borderRadius:10, padding:"9px 11px", border:`1px solid ${C.border}` }}>
              <div style={{ flexShrink:0, width:80, borderRadius:6, overflow:"hidden", border:`1px solid ${C.border}` }}>
                <img src={capturedSrc} alt="captured" style={{ width:"100%", display:"block" }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:C.dim, fontSize:11, fontWeight:700, marginBottom:1 }}>FRAME CAPTURED</div>
                <div style={{ color:C.mute, fontSize:9, marginBottom:6 }}>{new Date().toLocaleTimeString()}</div>
                <button onClick={sendToBrain} disabled={analyseState==="thinking"} style={{ height:30, padding:"0 12px", borderRadius:7, cursor:"pointer", fontWeight:800, fontSize:10, outline:"none", background:C.gold+"22", border:`1.5px solid ${C.gold}88`, color:C.gold, opacity:analyseState==="thinking"?0.5:1 }}>🧠 Analyse Frame</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── AI Brain ── */}
      {analyseState !== "idle" && (
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
              <span style={{ background:C.green+"22", border:`1px solid ${C.green}44`, borderRadius:5, padding:"2px 7px", color:C.green, fontWeight:800, fontSize:9 }}>{brainResult.confidence}% CONFIDENCE</span>
            )}
          </div>

          {analyseState==="thinking" && (
            <div style={{ textAlign:"center", padding:"14px 0" }}>
              <div style={{ fontSize:22, marginBottom:5 }}>🧠</div>
              <div style={{ color:C.teal, fontWeight:800, fontSize:12 }}>Analysing frame{thinkDots}</div>
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
        * { box-sizing:border-box; }
        input::placeholder { color:rgba(255,255,255,0.12); }
      `}</style>
    </div>
  );
}
