import { useState, useEffect, useRef } from "react";

const C = {
  bg:     "#0a1628",
  card:   "#0d1f3a",
  border: "#1a2f4a",
  teal:   "#00d4aa",
  blue:   "#00a8ff",
  gold:   "#ffd700",
  red:    "#ff4400",
  sl:     "#00ffcc",
  mute:   "rgba(255,255,255,0.27)",
  dim:    "rgba(255,255,255,0.67)",
  white:  "#ffffff",
};

const FRAMES = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=640&q=80",
  "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=640&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=640&q=80",
  "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=640&q=80",
];

function PtzBtn({
  icon, cmd, onCmd,
}: {
  icon: string; cmd: string; onCmd: (c: string) => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onMouseDown={() => { setPressed(true); onCmd(cmd); setTimeout(() => setPressed(false), 350); }}
      style={{
        width: 50, height: 50, borderRadius: 25,
        background: pressed ? C.sl + "44" : C.sl + "18",
        border: `2px solid ${pressed ? C.sl : C.sl + "44"}`,
        color: C.sl, fontSize: 20, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}
    >
      {icon}
    </button>
  );
}

export default function SmartLifeDemo() {
  const [frameIdx, setFrameIdx] = useState(0);
  const [snapped, setSnapped]   = useState<string | null>(null);
  const [ptzLog,  setPtzLog]    = useState<string | null>(null);
  const [tick,    setTick]      = useState(0);
  const ptzTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulate live stream by cycling frames every 3s
  useEffect(() => {
    const t = setInterval(() => {
      setFrameIdx((i) => (i + 1) % FRAMES.length);
      setTick((n) => n + 1);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const handlePTZ = (cmd: string) => {
    setPtzLog(`PTZ → ${cmd.toUpperCase()}`);
    if (ptzTimeout.current) clearTimeout(ptzTimeout.current);
    ptzTimeout.current = setTimeout(() => setPtzLog(null), 1200);
  };

  const handleSnapshot = () => {
    setSnapped(FRAMES[frameIdx]);
  };

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: C.bg, fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      padding: 16, boxSizing: "border-box",
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>📷</span>
          <div>
            <div style={{ color: C.sl, fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>SMARTLIFE LIVE VIEW</div>
            <div style={{ color: C.mute, fontSize: 11 }}>192.168.4.1 · SmartLife Camera</div>
          </div>
        </div>
        {/* LIVE badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: C.red + "22", border: `1px solid ${C.red}44`,
          borderRadius: 6, padding: "3px 8px",
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.red, animation: "pulse 1s infinite" }} />
          <span style={{ color: C.red, fontWeight: 800, fontSize: 11 }}>LIVE</span>
        </div>
      </div>

      {/* Auto-scan banner */}
      <div style={{
        background: C.teal + "18", border: `1px solid ${C.teal}44`,
        borderRadius: 10, padding: "8px 12px", marginBottom: 12,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>✓</span>
        <div>
          <div style={{ color: C.teal, fontWeight: 800, fontSize: 12 }}>
            CONNECTED — SmartLife Indoor PTZ Cam
          </div>
          <div style={{ color: C.mute, fontSize: 10 }}>
            192.168.4.1 · 23ms · /snapshot.cgi ← auto-discovered
          </div>
        </div>
      </div>

      {/* Stream frame */}
      <div style={{
        borderRadius: 12, overflow: "hidden",
        border: `1.5px solid ${C.sl}44`,
        marginBottom: 14, position: "relative",
        aspectRatio: "16/9", background: "#000",
      }}>
        <img
          src={FRAMES[frameIdx]}
          alt="Live stream"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "opacity 0.4s" }}
        />
        {/* Overlays */}
        <div style={{
          position: "absolute", bottom: 8, left: 8, right: 8,
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        }}>
          <div style={{
            background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "3px 8px",
            color: C.sl, fontSize: 11, fontWeight: 700, fontFamily: "monospace",
          }}>
            192.168.4.1/snapshot.cgi?_t={tick}
          </div>
          <div style={{
            background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "3px 8px",
            color: C.gold, fontSize: 11, fontWeight: 700,
          }}>
            {new Date().toLocaleTimeString()}
          </div>
        </div>
        {ptzLog && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "5px 14px",
            color: C.sl, fontWeight: 800, fontSize: 13,
          }}>
            {ptzLog}
          </div>
        )}
      </div>

      {/* Controls: PTZ (left) + Buttons (right) */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 14 }}>
        {/* PTZ D-pad */}
        <div style={{ background: C.card, borderRadius: 14, padding: 12, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.mute, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textAlign: "center", marginBottom: 8 }}>PTZ</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <PtzBtn icon="↑" cmd="up" onCmd={handlePTZ} />
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <PtzBtn icon="←" cmd="left" onCmd={handlePTZ} />
              <button
                onClick={() => handlePTZ("stop")}
                style={{
                  width: 50, height: 50, borderRadius: 25,
                  background: C.red + "22", border: `2px solid ${C.red}66`,
                  color: C.red, fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >■</button>
              <PtzBtn icon="→" cmd="right" onCmd={handlePTZ} />
            </div>
            <PtzBtn icon="↓" cmd="down" onCmd={handlePTZ} />
            {/* Zoom row */}
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <button onClick={() => handlePTZ("zoomin")} style={{ flex: 1, height: 30, borderRadius: 6, background: C.sl + "18", border: `1.5px solid ${C.sl}44`, color: C.sl, cursor: "pointer", fontSize: 12 }}>🔍+</button>
              <button onClick={() => handlePTZ("zoomout")} style={{ flex: 1, height: 30, borderRadius: 6, background: C.sl + "18", border: `1.5px solid ${C.sl}44`, color: C.sl, cursor: "pointer", fontSize: 12 }}>🔍−</button>
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingTop: 32 }}>
          <button
            onClick={handleSnapshot}
            style={{
              height: 44, borderRadius: 10, background: C.teal + "22",
              border: `1.5px solid ${C.teal}88`, color: C.teal,
              fontWeight: 800, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            📸 SNAPSHOT
          </button>
          <a
            href="http://192.168.4.1/"
            target="_blank"
            rel="noreferrer"
            style={{
              height: 44, borderRadius: 10, background: C.sl + "18",
              border: `1.5px solid ${C.sl}44`, color: C.sl,
              fontWeight: 800, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, textDecoration: "none",
            }}
          >
            🌐 WEB UI
          </a>
          {/* Endpoint info */}
          <div style={{ background: C.border, borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ color: C.mute, fontSize: 10, fontFamily: "monospace" }}>
              192.168.4.1/snapshot.cgi
            </div>
          </div>
          {/* Status */}
          <div style={{ background: C.sl + "18", borderRadius: 8, padding: "6px 10px", border: `1px solid ${C.sl}33` }}>
            <div style={{ color: C.sl, fontSize: 11, fontWeight: 700 }}>● Connected · 23ms · frame #{tick}</div>
          </div>
        </div>
      </div>

      {/* Snapshot result */}
      {snapped && (
        <div style={{ background: C.card, borderRadius: 12, padding: 12, border: `1px solid ${C.border}`, gap: 8 }}>
          <div style={{ color: C.mute, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, marginBottom: 6 }}>LAST SNAPSHOT</div>
          <img src={snapped} alt="Snapshot" style={{ width: "100%", borderRadius: 8, display: "block" }} />
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
