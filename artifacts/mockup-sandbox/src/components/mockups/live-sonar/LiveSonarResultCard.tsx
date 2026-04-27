import { useState, useEffect, useRef } from "react";

const DEMO_RESULT = {
  species: "Barramundi",
  confidence: 89,
  fishCount: 2,
  depth: 4.5,
  liveBrand: "humminbird-mega-live-2",
  liveMode: "forward",
  targetShape: "Large bright oval, 3.8:1 L:H ratio",
  shadowAnalysis: "Long distinct shadow ~1.3× body length. Strong physostomous bladder return.",
  targetSeparation: "pair",
  bodyRatio: "3.8:1",
  structureProximity: "Adjacent to submerged timber",
  targetBoostActive: true,
  paletteDetected: "Original",
  sonarMode: "mega-live-forward",
  lure: "5\" Z-Man Slim SwimZ on 3/8oz TT Lures jighead — dead-stick past structure with 2s pauses",
  suggestion: "Two barra holding on submerged timber at 4.5m. Lead the fish by 3m, dead-stick through the snag zone. Shadow length confirms 70cm+ fish.",
  warning: null,
};

const BRAND_LABELS: Record<string, { name: string; color: string; bg: string }> = {
  "humminbird-mega-live-2":  { name: "MEGA LIVE 2",      color: "#ff9a00", bg: "rgba(255,154,0,0.12)" },
  "garmin-livescope-plus":   { name: "LIVESCOPE PLUS",   color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
  "lowrance-activetarget-2": { name: "ACTIVETARGET 2",   color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  "simrad-activetarget":     { name: "SIMRAD AT2",       color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  "unknown-live-sonar":      { name: "LIVE SONAR",       color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
};

const MODE_ICONS: Record<string, string> = {
  forward:     "→",
  down:        "↓",
  landscape:   "↔",
  perspective: "⊙",
  scout:       "◎",
};

function SonarDisplay({ fishCount }: { fishCount: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background gradient — dark charcoal (MEGA Live 2 style)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#080c0a");
    bg.addColorStop(1, "#0a0d0b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Depth scale marks (right edge)
    ctx.strokeStyle = "rgba(255,154,0,0.35)";
    ctx.lineWidth = 0.5;
    for (let d = 1; d <= 8; d++) {
      const y = (d / 9) * H;
      ctx.beginPath(); ctx.moveTo(W - 22, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = "rgba(255,154,0,0.7)";
      ctx.font = "9px monospace";
      ctx.fillText(`${d}m`, W - 20, y + 3);
    }

    // Bottom echo — irregular bright band at base
    ctx.fillStyle = "#ff9a00";
    ctx.globalAlpha = 0.85;
    for (let x = 0; x < W; x++) {
      const noise = Math.sin(x * 0.08) * 3 + Math.sin(x * 0.17) * 2;
      const bY = H - 18 + noise;
      const bH = 14 + Math.abs(Math.sin(x * 0.05)) * 4;
      ctx.fillRect(x, bY, 1, bH);
    }
    ctx.globalAlpha = 1;

    // Structure echo — snag blob
    const sX = W * 0.38;
    const sY = H - 38;
    const grad = ctx.createRadialGradient(sX, sY, 2, sX, sY, 28);
    grad.addColorStop(0, "rgba(255,200,80,0.9)");
    grad.addColorStop(0.5, "rgba(255,140,20,0.5)");
    grad.addColorStop(1, "rgba(255,100,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(sX, sY, 28, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fish bodies + shadows
    const positions = fishCount >= 2
      ? [{ x: W * 0.35, y: H * 0.44 }, { x: W * 0.42, y: H * 0.52 }]
      : [{ x: W * 0.38, y: H * 0.47 }];

    for (const pos of positions) {
      const fX = pos.x;
      const fY = pos.y;

      // Acoustic shadow (below fish)
      const shadowGrad = ctx.createLinearGradient(fX - 12, fY + 6, fX + 12, fY + 38);
      shadowGrad.addColorStop(0, "rgba(0,0,0,0.85)");
      shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(fX, fY + 20, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fish body glow
      const bodyGlow = ctx.createRadialGradient(fX, fY, 2, fX, fY, 22);
      bodyGlow.addColorStop(0, "rgba(255,255,255,0.95)");
      bodyGlow.addColorStop(0.4, "rgba(255,200,80,0.7)");
      bodyGlow.addColorStop(1, "rgba(255,120,0,0)");
      ctx.fillStyle = bodyGlow;
      ctx.beginPath();
      ctx.ellipse(fX, fY, 20, 8, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.beginPath();
      ctx.ellipse(fX, fY, 12, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scan line (orange horizontal sweep)
    const scanGrad = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.47);
    scanGrad.addColorStop(0, "rgba(255,154,0,0)");
    scanGrad.addColorStop(0.5, "rgba(255,154,0,0.15)");
    scanGrad.addColorStop(1, "rgba(255,154,0,0)");
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, H * 0.44, W, 6);

    // MEGA LIVE watermark
    ctx.fillStyle = "rgba(255,154,0,0.25)";
    ctx.font = "bold 9px monospace";
    ctx.fillText("MEGA LIVE 2", 8, 14);
    ctx.fillText("FWD  ●", 8, 26);

  }, [fishCount]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={180}
      style={{ width: "100%", borderRadius: "8px", display: "block" }}
    />
  );
}

function AnimatedValue({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const duration = 900;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span>{display}{suffix}</span>;
}

function ConfidenceBar({ value }: { value: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 200);
    return () => clearTimeout(t);
  }, [value]);
  const color = value >= 80 ? "#4ade80" : value >= 60 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 6, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: color,
          borderRadius: 4,
          boxShadow: `0 0 8px ${color}`,
          transition: "width 0.9s cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      />
    </div>
  );
}

export function LiveSonarResultCard() {
  const r = DEMO_RESULT;
  const brand = BRAND_LABELS[r.liveBrand] ?? BRAND_LABELS["unknown-live-sonar"];
  const modeIcon = MODE_ICONS[r.liveMode] ?? "?";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #060809 0%, #080d0a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* Header bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 6px #4ade80",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
            <span style={{ color: "#9ca3af", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
              Live Sonar Analysis
            </span>
          </div>
          <div style={{
            padding: "3px 10px",
            borderRadius: 12,
            background: brand.bg,
            border: `1px solid ${brand.color}40`,
            color: brand.color,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
          }}>
            {modeIcon} {brand.name}
          </div>
        </div>

        {/* Sonar display */}
        <div style={{
          borderRadius: 10,
          overflow: "hidden",
          border: `1px solid rgba(255,154,0,0.2)`,
          marginBottom: 14,
          boxShadow: "0 0 24px rgba(255,154,0,0.08)",
        }}>
          <SonarDisplay fishCount={r.fishCount} />
        </div>

        {/* Species result */}
        <div style={{
          background: "linear-gradient(135deg, rgba(74,222,128,0.06) 0%, rgba(74,222,128,0.02) 100%)",
          border: "1px solid rgba(74,222,128,0.18)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
              {r.species}
            </span>
            <span style={{
              color: "#4ade80",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: -1,
              fontVariantNumeric: "tabular-nums",
            }}>
              <AnimatedValue value={r.confidence} suffix="%" />
            </span>
          </div>
          <ConfidenceBar value={r.confidence} />
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <span style={{ color: "#9ca3af", fontSize: 12 }}>
              🐟 {r.fishCount} fish · {r.depth}m depth
            </span>
            <span style={{ color: "#9ca3af", fontSize: 12 }}>
              {r.targetSeparation === "pair" ? "👥 Pair" : `👤 ${r.targetSeparation}`}
            </span>
          </div>
        </div>

        {/* Live sonar specifics */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 10,
        }}>
          <div style={{ color: "#6b7280", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            Shape Analysis
          </div>

          {[
            { label: "Body Shape",   value: r.targetShape,         icon: "⬭" },
            { label: "Shadow",       value: r.shadowAnalysis,      icon: "◐" },
            { label: "Structure",    value: r.structureProximity,  icon: "🪵" },
            { label: "Palette",      value: r.paletteDetected,     icon: "🎨" },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{
              display: "flex",
              gap: 10,
              marginBottom: 7,
              alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 13, width: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
              <div>
                <div style={{ color: "#6b7280", fontSize: 10, letterSpacing: 0.5, marginBottom: 1 }}>{label}</div>
                <div style={{ color: "#e5e7eb", fontSize: 12, lineHeight: 1.4 }}>{value}</div>
              </div>
            </div>
          ))}

          {r.targetBoostActive && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
              padding: "3px 10px",
              borderRadius: 20,
              background: "rgba(255,154,0,0.1)",
              border: "1px solid rgba(255,154,0,0.25)",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff9a00", boxShadow: "0 0 4px #ff9a00" }} />
              <span style={{ color: "#ff9a00", fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>TargetBoost™ Active</span>
            </div>
          )}
        </div>

        {/* No arches badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "rgba(255,100,100,0.06)",
          border: "1px solid rgba(255,100,100,0.15)",
          borderRadius: 8,
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <span style={{ color: "#9ca3af", fontSize: 10, lineHeight: 1.4 }}>
            <span style={{ color: "#f87171" }}>LIVE SONAR MODE</span> — No arch analysis. Fish identified by shape silhouette + acoustic shadow physics.
          </span>
        </div>

        {/* Lure recommendation */}
        <div style={{
          background: "rgba(96,165,250,0.05)",
          border: "1px solid rgba(96,165,250,0.15)",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 10,
        }}>
          <div style={{ color: "#60a5fa", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
            🎣 Lure Call
          </div>
          <div style={{ color: "#e5e7eb", fontSize: 12, lineHeight: 1.5 }}>{r.lure}</div>
        </div>

        {/* Strategy */}
        <div style={{
          padding: "12px 14px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ color: "#6b7280", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
            Strategy
          </div>
          <div style={{ color: "#d1d5db", fontSize: 12, lineHeight: 1.6 }}>{r.suggestion}</div>
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
