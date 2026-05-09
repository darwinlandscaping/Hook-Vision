import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type { RiverScanEntry } from "@/context/RiverScanContext";

interface ViewerPoint {
  x: number;
  y: number;
  depth: number;
  fish: number;
}

interface ViewerData {
  points: ViewerPoint[];
  maxDepth: number;
  minDepth: number;
  gridSize: number;
}

function normalizeScan(entry: RiverScanEntry): ViewerData {
  if (entry.points.length === 0) {
    return { points: [], maxDepth: 5, minDepth: 0, gridSize: 20 };
  }
  const centerLat = (entry.bbox.minLat + entry.bbox.maxLat) / 2;
  const centerLng = (entry.bbox.minLng + entry.bbox.maxLng) / 2;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);

  const raw = entry.points.map((p) => ({
    x: (p.lng - centerLng) * 111000 * cosLat,
    y: (p.lat - centerLat) * 111000,
    depth: p.depth,
    fish: p.fishCount,
  }));

  const minX = Math.min(...raw.map((p) => p.x));
  const minY = Math.min(...raw.map((p) => p.y));
  const maxX = Math.max(...raw.map((p) => p.x));
  const maxY = Math.max(...raw.map((p) => p.y));
  const range = Math.max(maxX - minX, maxY - minY, 20);

  return {
    points: raw.map((p) => ({ x: p.x - minX, y: p.y - minY, depth: p.depth, fish: p.fish })),
    maxDepth: entry.maxDepth,
    minDepth: entry.minDepth,
    gridSize: range,
  };
}

function buildHtml(data: ViewerData): string {
  const json = JSON.stringify(data);
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#020c16;overflow:hidden;touch-action:none}
canvas{display:block}
#ui{position:fixed;bottom:14px;left:0;right:0;display:flex;justify-content:center;gap:8px;z-index:10}
.btn{padding:6px 16px;border-radius:20px;border:1.5px solid;font:11px/1 'Courier New',monospace;cursor:pointer;letter-spacing:.05em;transition:background .15s}
.btn-2d,.btn-3d{background:rgba(0,201,167,.12);color:#00C9A7;border-color:#00C9A740}
.btn.active{background:rgba(0,201,167,.32);border-color:#00C9A7}
#stats{position:fixed;top:10px;left:10px;color:rgba(255,255,255,.45);font:9.5px/1.7 'Courier New',monospace;pointer-events:none}
#legend{position:fixed;top:10px;right:10px;pointer-events:none}
.leg{display:flex;align-items:center;gap:4px;margin-bottom:3px}
.lc{width:11px;height:11px;border-radius:2px;flex-shrink:0}
.lt{color:rgba(255,255,255,.4);font:8.5px 'Courier New',monospace}
#hint{position:fixed;bottom:46px;left:0;right:0;text-align:center;color:rgba(255,255,255,.18);font:9px monospace;pointer-events:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="stats"></div>
<div id="legend"></div>
<div id="hint" id="hint3d" style="display:none">← drag to rotate →</div>
<div id="ui">
  <button class="btn btn-2d active" id="b2">TOP MAP</button>
  <button class="btn btn-3d" id="b3">3D VIEW</button>
</div>
<script>
const SCAN=${json};
const c=document.getElementById('c');
const ctx=c.getContext('2d');
const dpr=window.devicePixelRatio||1;
let W,H;
function resize(){
  W=window.innerWidth;H=window.innerHeight;
  c.width=W*dpr;c.height=H*dpr;
  c.style.width=W+'px';c.style.height=H+'px';
  ctx.scale(dpr,dpr);render();
}
window.addEventListener('resize',resize);

function depthColor(d,max){
  if(!max)return'rgb(0,100,150)';
  const t=Math.min(d/max,1);
  const s=[[255,224,80],[80,220,180],[0,160,140],[0,80,190],[0,20,90]];
  const si=t*(s.length-1),i=Math.floor(si),f=si-i;
  const a=s[Math.min(i,s.length-1)],b=s[Math.min(i+1,s.length-1)];
  return\`rgb(\${(a[0]+(b[0]-a[0])*f)|0},\${(a[1]+(b[1]-a[1])*f)|0},\${(a[2]+(b[2]-a[2])*f)|0})\`;
}

const N=36;
let _grid=null;
function getGrid(){
  if(_grid)return _grid;
  const gs=SCAN.gridSize||20;
  const pts=SCAN.points;
  _grid=[];
  for(let gy=0;gy<N;gy++){
    const row=[];
    for(let gx=0;gx<N;gx++){
      const wx=gx/(N-1)*gs,wy=gy/(N-1)*gs;
      let sw=0,swz=0;
      for(const p of pts){
        const d2=(p.x-wx)**2+(p.y-wy)**2+0.01;
        const w=1/d2;
        sw+=w;swz+=w*p.depth;
      }
      row.push(sw>0?swz/sw:(SCAN.minDepth||1));
    }
    _grid.push(row);
  }
  return _grid;
}

function draw2D(){
  const g=getGrid();
  const gs=SCAN.gridSize||20;
  const size=Math.min(W,H*0.82)*0.92;
  const cs=size/N;
  const ox=(W-size)/2,oy=(H*0.82-size)/2+14;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#020c16';ctx.fillRect(0,0,W,H);

  for(let gy=0;gy<N;gy++)
    for(let gx=0;gx<N;gx++){
      ctx.fillStyle=depthColor(g[gy][gx],SCAN.maxDepth);
      ctx.fillRect(ox+gx*cs,oy+gy*cs,cs+.5,cs+.5);
    }

  const levels=[1,2,4,6,8,12];
  for(const lv of levels){
    ctx.strokeStyle=\`rgba(0,0,0,\${lv<=3?.3:.15})\`;
    ctx.lineWidth=lv<=3?1:.5;
    for(let gy=0;gy<N-1;gy++)
      for(let gx=0;gx<N-1;gx++){
        const d00=g[gy][gx],d10=g[gy][gx+1],d01=g[gy+1][gx];
        if((d00<lv)!==(d10<lv)){
          const t=(lv-d00)/(d10-d00);
          ctx.beginPath();ctx.moveTo(ox+(gx+t)*cs,oy+gy*cs);ctx.lineTo(ox+(gx+t)*cs,oy+(gy+1)*cs);ctx.stroke();
        }
        if((d00<lv)!==(d01<lv)){
          const t=(lv-d00)/(d01-d00);
          ctx.beginPath();ctx.moveTo(ox+gx*cs,oy+(gy+t)*cs);ctx.lineTo(ox+(gx+1)*cs,oy+(gy+t)*cs);ctx.stroke();
        }
      }
  }

  const pts=SCAN.points;
  if(pts.length>1){
    ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1.5;ctx.setLineDash([3,4]);
    ctx.beginPath();
    for(let i=0;i<pts.length;i++){
      const sx=ox+pts[i].x/gs*size,sy=oy+pts[i].y/gs*size;
      i===0?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);
    }
    ctx.stroke();ctx.setLineDash([]);
  }

  const labeled=new Set();
  for(const p of pts){
    const sx=ox+p.x/gs*size,sy=oy+p.y/gs*size;
    if(p.fish>0){
      ctx.fillStyle='#FF6B00';
      ctx.beginPath();ctx.arc(sx,sy,4+p.fish*.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.font='bold 8px monospace';ctx.textAlign='center';
      ctx.fillText(p.fish,sx,sy+3);
    }
    const key=Math.round(p.x/gs*10)+'-'+Math.round(p.y/gs*10);
    if(!labeled.has(key)&&p.depth){
      labeled.add(key);
      ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(sx-15,sy-18,30,13);
      ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='8.5px monospace';ctx.textAlign='center';
      ctx.fillText(p.depth.toFixed(1)+'m',sx,sy-8);
    }
  }

  if(pts.length>0){
    const sp=pts[0],sx=ox+sp.x/gs*size,sy=oy+sp.y/gs*size;
    ctx.fillStyle='#00C9A7';ctx.beginPath();ctx.arc(sx,sy,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,201,167,.3)';ctx.beginPath();ctx.arc(sx,sy,9,0,Math.PI*2);ctx.fill();
  }

  ctx.fillStyle='rgba(255,255,255,.15)';ctx.font='9px monospace';ctx.textAlign='left';
  ctx.fillText(\`\${SCAN.minDepth?.toFixed(1)||'?'}m SHALLOW\`,ox+2,oy+size+12);
  ctx.textAlign='right';
  ctx.fillText(\`DEEP \${SCAN.maxDepth?.toFixed(1)||'?'}m\`,ox+size-2,oy+size+12);
}

let rot=-0.5,zoom=1,txStart=null,txRot;
function draw3D(){
  const g=getGrid();
  const gs=SCAN.gridSize||20;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#020c16';ctx.fillRect(0,0,W,H);
  const ts=(Math.min(W,H)*0.025)*zoom;
  const th=ts*.5;
  const hm=ts*3.5/Math.max(SCAN.maxDepth,1);
  const cx=W/2,cy=H*.52;
  const co=Math.cos(rot),si=Math.sin(rot);
  function iso(gx,gy,d){
    const rx=(gx-N/2)*co-(gy-N/2)*si;
    const ry=(gx-N/2)*si+(gy-N/2)*co;
    return{x:cx+rx*ts-ry*ts,y:cy+rx*th+ry*th-d*hm};
  }
  const tiles=[];
  for(let gy=0;gy<N-1;gy++)
    for(let gx=0;gx<N-1;gx++){
      const d=(g[gy][gx]+g[gy+1][gx]+g[gy][gx+1]+g[gy+1][gx+1])/4;
      tiles.push({gx,gy,d,sy:iso(gx+.5,gy+.5,d).y});
    }
  tiles.sort((a,b)=>a.sy-b.sy);
  for(const t of tiles){
    const{gx,gy,d}=t;
    const p0=iso(gx,gy,g[gy][gx]),p1=iso(gx+1,gy,g[gy][gx+1]);
    const p2=iso(gx+1,gy+1,g[gy+1][gx+1]),p3=iso(gx,gy+1,g[gy+1][gx]);
    ctx.fillStyle=depthColor(d,SCAN.maxDepth);
    ctx.strokeStyle='rgba(0,0,0,.08)';ctx.lineWidth=.3;
    ctx.beginPath();
    ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);
    ctx.closePath();ctx.fill();ctx.stroke();
  }
  const pts=SCAN.points;
  if(pts.length>1){
    ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=1.5;
    ctx.beginPath();
    for(let i=0;i<pts.length;i++){
      const gx=pts[i].x/gs*(N-1),gy=pts[i].y/gs*(N-1);
      const gi=Math.min(Math.floor(gy),N-1),gj=Math.min(Math.floor(gx),N-1);
      const p=iso(gx,gy,(g[gi]?.[gj]||0)+.3);
      i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
  }
  for(const p of pts){
    if(p.fish>0){
      const gx=p.x/gs*(N-1),gy=p.y/gs*(N-1);
      const gi=Math.min(Math.floor(gy),N-1),gj=Math.min(Math.floor(gx),N-1);
      const pos=iso(gx,gy,(g[gi]?.[gj]||0)+.5);
      ctx.fillStyle='#FF6B00';
      ctx.beginPath();ctx.arc(pos.x,pos.y,4+p.fish*.5,0,Math.PI*2);ctx.fill();
    }
  }
  document.getElementById('hint').style.display='block';
}

c.addEventListener('touchstart',e=>{if(mode==='3d'){txStart=e.touches[0].clientX;txRot=rot;}},{passive:true});
c.addEventListener('touchmove',e=>{
  if(mode==='3d'&&txStart!==null){
    e.preventDefault();
    rot=txRot+(e.touches[0].clientX-txStart)*0.009;
    render();
  }
},{passive:false});
c.addEventListener('touchend',()=>{txStart=null;});

function buildLegend(){
  const m=SCAN.maxDepth||10;
  const steps=[[0,'0m'],[m*.25,''],[m*.5,''],[m*.75,''],[m,m.toFixed(1)+'m']];
  document.getElementById('legend').innerHTML=steps.map(([d,l])=>
    \`<div class="leg"><div class="lc" style="background:\${depthColor(d,m)}"></div><div class="lt">\${l}</div></div>\`
  ).join('');
}
function buildStats(){
  const fish=SCAN.points.reduce((s,p)=>s+p.fish,0);
  document.getElementById('stats').innerHTML=
    \`DEPTH \${SCAN.minDepth?.toFixed(1)||'?'}–\${SCAN.maxDepth?.toFixed(1)||'?'}m\\nPOINTS \${SCAN.points.length}\\nFISH \${fish}\`.replace(/\\n/g,'<br>');
}

let mode='2d';
function setMode(m){
  mode=m;
  document.getElementById('b2').classList.toggle('active',m==='2d');
  document.getElementById('b3').classList.toggle('active',m==='3d');
  document.getElementById('hint').style.display=m==='3d'?'block':'none';
  render();
}
document.getElementById('b2').onclick=()=>setMode('2d');
document.getElementById('b3').onclick=()=>setMode('3d');
function render(){mode==='2d'?draw2D():draw3D();}
buildLegend();buildStats();resize();
</script>
</body>
</html>`;
}

interface Props {
  scan: RiverScanEntry;
  style?: object;
}

export function RiverScan3DViewer({ scan, style }: Props) {
  const html = useMemo(() => buildHtml(normalizeScan(scan)), [scan]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, style]}>
        <iframe
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: "none", background: "#020c16" }}
          sandbox="allow-scripts"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020c16", overflow: "hidden" },
  webview: { flex: 1, backgroundColor: "#020c16" },
});
