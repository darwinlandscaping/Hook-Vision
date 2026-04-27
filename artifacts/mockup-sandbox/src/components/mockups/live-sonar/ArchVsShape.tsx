import { useEffect, useRef, useState } from "react";

function TraditionalSonar() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background — dark scrolling 2D sonar
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#020408");
    bg.addColorStop(1, "#040810");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Time scrolling indicator (faint vertical lines right to left)
    for (let x = 0; x < W; x += 24) {
      ctx.strokeStyle = "rgba(0,100,200,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H - 20);
      ctx.stroke();
    }

    // Bottom echo line — wavy (time-history shows undulation)
    ctx.beginPath();
    ctx.moveTo(0, H - 22);
    for (let x = 0; x <= W; x++) {
      const y = H - 22 + Math.sin(x * 0.09 + 1) * 4 + Math.sin(x * 0.04) * 2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    const bottomGrad = ctx.createLinearGradient(0, H - 28, 0, H);
    bottomGrad.addColorStop(0, "rgba(255,140,0,0.9)");
    bottomGrad.addColorStop(0.4, "rgba(200,80,0,0.6)");
    bottomGrad.addColorStop(1, "rgba(100,30,0,0)");
    ctx.fillStyle = bottomGrad;
    ctx.fill();

    // ── ARCHES — fish U-shaped returns ──────────────────────────────────────
    const arches = [
      { cx: W * 0.22, cy: H * 0.48, r: 22, brightness: "red" },
      { cx: W * 0.38, cy: H * 0.45, r: 26, brightness: "red" },
      { cx: W * 0.55, cy: H * 0.50, r: 18, brightness: "orange" },
      { cx: W * 0.70, cy: H * 0.52, r: 14, brightness: "yellow" },
    ];

    for (const arch of arches) {
      const colors: Record<string, string[]> = {
        red:    ["#ff2200", "#ff6600", "#ffaa00"],
        orange: ["#ff6600", "#ffaa00", "#ffdd00"],
        yellow: ["#ffaa00", "#ffdd00", "#ffffaa"],
      };
      const [c1, c2, c3] = colors[arch.brightness];

      // Shadow void beneath arch
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(arch.cx, arch.cy + arch.r * 0.6, arch.r * 0.7, arch.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Arch stroke (top half of ellipse = U-shape open upward)
      ctx.beginPath();
      ctx.arc(arch.cx, arch.cy, arch.r, Math.PI, 0, false);
      ctx.strokeStyle = c1;
      ctx.lineWidth = arch.brightness === "red" ? 3.5 : 2.5;
      ctx.shadowColor = c2;
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Bright core top
      ctx.beginPath();
      ctx.arc(arch.cx, arch.cy, arch.r * 0.6, Math.PI, 0, false);
      ctx.strokeStyle = c3;
      ctx.lineWidth = arch.brightness === "red" ? 2 : 1.5;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // "Scrolling →" arrow to show time axis
    ctx.fillStyle = "rgba(100,150,255,0.4)";
    ctx.font = "10px monospace";
    ctx.fillText("← time scrolls", 4, H - 4);

    // Depth scale
    ctx.strokeStyle = "rgba(100,150,255,0.25)";
    ctx.lineWidth = 0.5;
    ctx.fillStyle = "rgba(100,150,255,0.5)";
    ctx.font = "8px monospace";
    for (let d = 2; d <= 10; d += 2) {
      const y = (d / 12) * (H - 20);
      ctx.beginPath();
      ctx.moveTo(W - 20, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillText(`${d}m`, W - 18, y + 3);
    }

    // Label
    ctx.fillStyle = "rgba(100,150,255,0.6)";
    ctx.font = "bold 9px monospace";
    ctx.fillText("TRADITIONAL 2D", 4, 12);
    ctx.fillStyle = "rgba(100,150,255,0.35)";
    ctx.fillText("Lowrance HDS", 4, 22);

  }, []);

  return (
    <canvas
      ref={ref}
      width={280}
      height={160}
      style={{ width: "100%", borderRadius: 8, display: "block" }}
    />
  );
}

function LiveSonarPanel() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background — MEGA Live 2 dark
    ctx.fillStyle = "#060b07";
    ctx.fillRect(0, 0, W, H);

    // Static horizontal distance lines (x = distance ahead)
    for (let x = 0; x < W; x += 30) {
      ctx.strokeStyle = "rgba(255,154,0,0.04)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H - 20);
      ctx.stroke();
    }

    // Bottom echo — crisp band (no wavy history, it's STATIC real-time)
    ctx.fillStyle = "#ff9a00";
    ctx.globalAlpha = 0.8;
    for (let x = 0; x < W; x++) {
      const y = H - 20 + Math.sin(x * 0.06) * 2;
      ctx.fillRect(x, y, 1, H - y);
    }
    ctx.globalAlpha = 1;

    // Structure blob
    const sg = ctx.createRadialGradient(W * 0.42, H - 34, 2, W * 0.42, H - 34, 24);
    sg.addColorStop(0, "rgba(255,200,80,0.85)");
    sg.addColorStop(0.6, "rgba(255,120,0,0.4)");
    sg.addColorStop(1, "rgba(255,80,0,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(W * 0.42, H - 34, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fish as SHAPES — two barramundi
    const fish = [
      { cx: W * 0.38, cy: H * 0.43, rx: 20, ry: 7 },
      { cx: W * 0.47, cy: H * 0.52, rx: 17, ry: 6 },
    ];

    for (const f of fish) {
      // Acoustic shadow (below, trailing)
      const sg2 = ctx.createLinearGradient(f.cx - f.rx, f.cy + 6, f.cx + f.rx, f.cy + f.ry * 5.5);
      sg2.addColorStop(0, "rgba(0,0,0,0.88)");
      sg2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg2;
      ctx.beginPath();
      ctx.ellipse(f.cx, f.cy + f.ry * 2.8, f.rx * 0.75, f.ry * 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body glow halo
      const bg2 = ctx.createRadialGradient(f.cx, f.cy, 2, f.cx, f.cy, f.rx + 8);
      bg2.addColorStop(0, "rgba(255,255,255,0.9)");
      bg2.addColorStop(0.4, "rgba(255,180,60,0.6)");
      bg2.addColorStop(1, "rgba(255,100,0,0)");
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.ellipse(f.cx, f.cy, f.rx, f.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Solid bright core
      ctx.fillStyle = "rgba(255,255,255,0.97)";
      ctx.beginPath();
      ctx.ellipse(f.cx, f.cy, f.rx * 0.6, f.ry * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // STATIC indicator — no scroll arrow
    ctx.fillStyle = "rgba(255,154,0,0.4)";
    ctx.font = "10px monospace";
    ctx.fillText("← distance ahead →", 4, H - 4);

    // Depth scale
    ctx.strokeStyle = "rgba(255,154,0,0.25)";
    ctx.lineWidth = 0.5;
    ctx.fillStyle = "rgba(255,154,0,0.55)";
    ctx.font = "8px monospace";
    for (let d = 2; d <= 10; d += 2) {
      const y = (d / 12) * (H - 20);
      ctx.beginPath();
      ctx.moveTo(W - 20, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillText(`${d}m`, W - 18, y + 3);
    }

    // Label
    ctx.fillStyle = "rgba(255,154,0,0.65)";
    ctx.font = "bold 9px monospace";
    ctx.fillText("MEGA LIVE 2  FWD", 4, 12);
    ctx.fillStyle = "rgba(255,154,0,0.35)";
    ctx.fillText("Humminbird HELIX 12", 4, 22);

  }, []);

  return (
    <canvas
      ref={ref}
      width={280}
      height={160}
      style={{ width: "100%", borderRadius: 8, display: "block" }}
    />
  );
}

const DIFFERENCES = [
  {
    topic: "Fish appearance",
    traditional: "U-shaped ARCHES — created as fish swims through the beam over time",
    live: "BODY SHAPES — solid bright oval silhouettes of the actual fish body",
    icon: "🐟",
  },
  {
    topic: "Time vs Space",
    traditional: "Time axis — display SCROLLS right to left, showing history",
    live: "Spatial map — display is STATIC real-time, showing where things ARE NOW",
    icon: "⏱",
  },
  {
    topic: "Acoustic shadow",
    traditional: "Dark void BELOW the arch peak (confirms large swim bladder)",
    live: "Dark shadow BEHIND/BELOW the body shape (trails away from transducer)",
    icon: "◐",
  },
  {
    topic: "Bottom echo",
    traditional: "WAVY horizontal line at bottom — undulates with boat movement",
    live: "CRISP bright band — static, sharp, no scroll history artifacts",
    icon: "━",
  },
  {
    topic: "Fish count",
    traditional: "One arch per fish pass — same fish may arch multiple times",
    live: "One body shape per fish — exact count visible in real time",
    icon: "🔢",
  },
  {
    topic: "Movement",
    traditional: "Cannot see fish moving in real time — only historical arches",
    live: "Watch fish SWIM in real time — barra approaching lure visible",
    icon: "🏃",
  },
];

export function ArchVsShape() {
  const [highlight, setHighlight] = useState<number | null>(null);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #060809 0%, #07080a 100%)",
      padding: "20px 18px",
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      color: "#e5e7eb",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ color: "#6b7280", fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 }}>
          Why Live Sonar Needs A Specialist
        </div>
        <h1 style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
          Arch vs Shape
        </h1>
      </div>

      {/* Side-by-side sonar displays */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        <div>
          <div style={{
            color: "#60a5fa",
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 6,
            textAlign: "center",
          }}>
            ← Traditional 2D
          </div>
          <div style={{ border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, overflow: "hidden" }}>
            <TraditionalSonar />
          </div>
        </div>
        <div>
          <div style={{
            color: "#ff9a00",
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 6,
            textAlign: "center",
          }}>
            Live Sonar →
          </div>
          <div style={{ border: "1px solid rgba(255,154,0,0.25)", borderRadius: 8, overflow: "hidden" }}>
            <LiveSonarPanel />
          </div>
        </div>
      </div>

      {/* Key call-out */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 18,
      }}>
        <div style={{
          padding: "10px 12px",
          background: "rgba(96,165,250,0.06)",
          border: "1px solid rgba(96,165,250,0.2)",
          borderRadius: 10,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>〜</div>
          <div style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Arch Analysis</div>
          <div style={{ color: "#9ca3af", fontSize: 10, lineHeight: 1.4 }}>
            Time-history scroll.<br />
            Arch height = fish size.<br />
            Arch colour = swim bladder.
          </div>
        </div>
        <div style={{
          padding: "10px 12px",
          background: "rgba(255,154,0,0.06)",
          border: "1px solid rgba(255,154,0,0.25)",
          borderRadius: 10,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>⬭</div>
          <div style={{ color: "#ff9a00", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Shape Analysis</div>
          <div style={{ color: "#9ca3af", fontSize: 10, lineHeight: 1.4 }}>
            Real-time spatial map.<br />
            Body oval ratio = species.<br />
            Shadow length = size.
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ color: "#6b7280", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
          Key Differences
        </div>
        {DIFFERENCES.map((d, i) => (
          <div
            key={d.topic}
            onClick={() => setHighlight(highlight === i ? null : i)}
            style={{
              marginBottom: 8,
              padding: "10px 12px",
              background: highlight === i ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${highlight === i ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)"}`,
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: highlight === i ? 8 : 0 }}>
              <span style={{ fontSize: 14 }}>{d.icon}</span>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>{d.topic}</span>
              <span style={{ marginLeft: "auto", color: "#4b5563", fontSize: 12 }}>{highlight === i ? "−" : "+"}</span>
            </div>
            {highlight === i && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingLeft: 22 }}>
                <div>
                  <div style={{ color: "#60a5fa", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
                    Traditional 2D
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 11, lineHeight: 1.5 }}>{d.traditional}</div>
                </div>
                <div>
                  <div style={{ color: "#ff9a00", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
                    Live Sonar
                  </div>
                  <div style={{ color: "#d1d5db", fontSize: 11, lineHeight: 1.5 }}>{d.live}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ color: "#374151", fontSize: 10, textAlign: "center", marginTop: 12 }}>
        Tap each row to expand · POST /api/live-sonar-analyze
      </div>
    </div>
  );
}
