import { useState } from "react";

const BRANDS = [
  {
    id: "mega-live-2",
    name: "Humminbird MEGA Live 2",
    year: "Jan 2025",
    tagline: "15 colour palettes · TargetBoost™ · Landscape mode",
    bg: "#0a0c08",
    accentColor: "#ff9a00",
    headerBg: "linear-gradient(135deg, rgba(255,154,0,0.12) 0%, rgba(255,100,0,0.05) 100%)",
    borderColor: "rgba(255,154,0,0.3)",
    modes: ["Forward", "Down", "Landscape", "Down+Flasher"],
    modeDescriptions: {
      "Forward": "0–18m ahead of boat. Fish appear with shadow below body.",
      "Down": "Straight down. Shadow trails to one side.",
      "Landscape": "Wide horizontal sweep — exclusive to MEGA Live 2. Best for shallow flats.",
      "Down+Flasher": "Combo: down imaging + circular Flasher wheel sidebar.",
    },
    palettes: ["Original (orange-yellow)", "Blue Steel (cyan)", "Greyscale", "Amber", "Fire & Ice"],
    fishAppearance: "Bright orange/white oval bodies. Long distinct acoustic shadow. TargetBoost™ makes fish pop against dimmed structure.",
    keyTell: "Orange accent UI, 'MEGA LIVE' text, TargetBoost glow",
    uiColor: "#ff9a00",
    range: "0–18m forward · 0–25m down",
    frequency: "MEGA (1.2 MHz) for extreme clarity",
    highlight: "TargetBoost™",
    highlightDesc: "Isolates fish targets with enhanced contrast — fish go bright white while structure dims",
    sonarDisplayBg: "#080c09",
    fishGlow: "#ff9a00",
    fishCore: "#ffffff",
    shadowColor: "rgba(0,0,0,0.9)",
    uiAccentDark: "rgba(255,154,0,0.15)",
  },
  {
    id: "livescope-plus",
    name: "Garmin LiveScope Plus LVS34",
    year: "2023+",
    tagline: "35% better target sep · Perspective mode · 530–1100kHz",
    bg: "#050d07",
    accentColor: "#4ade80",
    headerBg: "linear-gradient(135deg, rgba(74,222,128,0.1) 0%, rgba(20,200,80,0.04) 100%)",
    borderColor: "rgba(74,222,128,0.25)",
    modes: ["Forward", "Down", "Perspective"],
    modeDescriptions: {
      "Forward": "Classic forward scan. Fish have shadow below. Depth scale on right.",
      "Down": "Straight down with enhanced target separation.",
      "Perspective": "UNIQUE — overhead bird's-eye view. Fish look like top-down ovals. Shadow extends to ONE SIDE (left or right, not below).",
    },
    palettes: ["Classic Green (signature)", "White on Black", "Colour (depth-coded)"],
    fishAppearance: "Crisp white/bright silhouettes on signature dark green background. Sharp edges, clear outlines. 35% better separation means individual fish discernible even in schools.",
    keyTell: "Dark green/teal background tint, 'LIVESCOPE' text label, boat icon at top-centre",
    uiColor: "#4ade80",
    range: "0–60m forward · 0–100m down",
    frequency: "530–1100 kHz auto-optimized",
    highlight: "Perspective Mode",
    highlightDesc: "Exclusive overhead bird's-eye view. Barra look like top-view ovals with fins visible as 'wings'. Shadow to left/right confirms shallow flat fishing.",
    sonarDisplayBg: "#040f06",
    fishGlow: "#4ade80",
    fishCore: "#e0ffe8",
    shadowColor: "rgba(0,0,0,0.85)",
    uiAccentDark: "rgba(74,222,128,0.1)",
  },
  {
    id: "activetarget-2",
    name: "Lowrance ActiveTarget 2",
    year: "2023+",
    tagline: "Scout 180° mode · Live hybrid mode · Dark navy UI",
    bg: "#060810",
    accentColor: "#60a5fa",
    headerBg: "linear-gradient(135deg, rgba(96,165,250,0.1) 0%, rgba(50,100,250,0.04) 100%)",
    borderColor: "rgba(96,165,250,0.25)",
    modes: ["Forward", "Down", "Scout (180°)", "Live"],
    modeDescriptions: {
      "Forward": "Standard forward scan with depth scale.",
      "Down": "Straight below the boat.",
      "Scout (180°)": "Wide 180° forward sweep — shows both sides simultaneously. Good for covering structure quickly.",
      "Live": "Hybrid down/perspective mode with real-time fish movement tracking.",
    },
    palettes: ["Navy Blue (default)", "White", "Colour contrast"],
    fishAppearance: "Medium-bright solid oval returns on dark navy background. Clear trailing shadow. Scout mode shows fish radiating from centre-point.",
    keyTell: "Dark navy/grey UI chrome, 'ACTIVE TARGET' label, blue-grey background tint",
    uiColor: "#60a5fa",
    range: "0–60m forward · 0–90m down",
    frequency: "500 kHz / 1000 kHz switchable",
    highlight: "Scout Mode",
    highlightDesc: "180° wide forward view covers both sides of the boat simultaneously. Ideal for scanning shallow structure edges.",
    sonarDisplayBg: "#05070f",
    fishGlow: "#60a5fa",
    fishCore: "#dbeafe",
    shadowColor: "rgba(0,0,0,0.82)",
    uiAccentDark: "rgba(96,165,250,0.1)",
  },
];

function MiniSonar({ brand }: { brand: typeof BRANDS[0] }) {
  const W = 260, H = 120;

  return (
    <div style={{
      borderRadius: 8,
      overflow: "hidden",
      background: brand.sonarDisplayBg,
      border: `1px solid ${brand.borderColor}`,
      position: "relative",
      height: H,
    }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%" }}>
        {/* Bottom echo */}
        <path
          d={`M0 ${H - 12} Q40 ${H - 16} 80 ${H - 11} Q120 ${H - 9} 160 ${H - 14} Q200 ${H - 12} ${W} ${H - 11} L${W} ${H} L0 ${H} Z`}
          fill={brand.accentColor}
          opacity="0.75"
        />
        {/* Structure snag */}
        <ellipse cx={W * 0.4} cy={H - 24} rx={22} ry={10} fill={brand.accentColor} opacity="0.55" />
        {/* Fish 1 — shadow then body */}
        <ellipse cx={W * 0.37} cy={H * 0.5 + 14} rx={14} ry={14} fill="rgba(0,0,0,0.82)" />
        <ellipse cx={W * 0.37} cy={H * 0.45} rx={18} ry={7} fill={brand.accentColor} opacity="0.7" />
        <ellipse cx={W * 0.37} cy={H * 0.45} rx={10} ry={4} fill={brand.fishCore} opacity="0.95" />
        {/* Fish 2 */}
        <ellipse cx={W * 0.46} cy={H * 0.55 + 12} rx={12} ry={12} fill="rgba(0,0,0,0.78)" />
        <ellipse cx={W * 0.46} cy={H * 0.5} rx={15} ry={6} fill={brand.accentColor} opacity="0.65" />
        <ellipse cx={W * 0.46} cy={H * 0.5} rx={8} ry={3} fill={brand.fishCore} opacity="0.9" />
        {/* Depth scale */}
        {[2, 4, 6].map((d, i) => (
          <g key={d}>
            <line x1={W - 18} y1={(i + 1) * (H / 4)} x2={W} y2={(i + 1) * (H / 4)} stroke={brand.accentColor} strokeWidth="0.5" opacity="0.4" />
            <text x={W - 16} y={(i + 1) * (H / 4) + 3} fontSize="7" fill={brand.accentColor} opacity="0.7" fontFamily="monospace">{d}m</text>
          </g>
        ))}
        {/* Brand watermark */}
        <text x={6} y={12} fontSize="7.5" fill={brand.accentColor} opacity="0.5" fontFamily="monospace" fontWeight="bold">
          {brand.id === "mega-live-2" ? "MEGA LIVE 2  FWD ●" : brand.id === "livescope-plus" ? "LIVESCOPE  FWD ●" : "ACTIVE TARGET  FWD ●"}
        </text>
      </svg>
    </div>
  );
}

export function LiveSonarBrandGuide() {
  const [active, setActive] = useState<string | null>("mega-live-2");

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #060809 0%, #07090c 100%)",
      padding: "20px 18px",
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      color: "#e5e7eb",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "#6b7280", fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 }}>
          Live Sonar Specialist
        </div>
        <h1 style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
          Brand Guide
        </h1>
        <p style={{ color: "#6b7280", fontSize: 12, margin: "6px 0 0", lineHeight: 1.5 }}>
          3 supported brands · Forward-facing sonar only · Fish appear as shapes, not arches
        </p>
      </div>

      {/* Core physics reminder */}
      <div style={{
        background: "rgba(249,115,22,0.07)",
        border: "1px solid rgba(249,115,22,0.2)",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 18,
        display: "flex",
        gap: 10,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
        <div>
          <div style={{ color: "#fb923c", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Key Physics Difference</div>
          <div style={{ color: "#9ca3af", fontSize: 11, lineHeight: 1.5 }}>
            Traditional 2D → fish appear as <span style={{ color: "#f87171" }}>U-shaped arches</span> (scrolling time axis).<br />
            Live sonar → fish appear as <span style={{ color: "#4ade80" }}>body shapes + acoustic shadows</span> (real-time spatial map).
          </div>
        </div>
      </div>

      {/* Brand cards */}
      {BRANDS.map((brand) => {
        const isOpen = active === brand.id;
        return (
          <div
            key={brand.id}
            style={{
              background: brand.bg,
              border: `1px solid ${isOpen ? brand.accentColor + "50" : brand.borderColor}`,
              borderRadius: 12,
              marginBottom: 12,
              overflow: "hidden",
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
            onClick={() => setActive(isOpen ? null : brand.id)}
          >
            {/* Brand header */}
            <div style={{
              padding: "12px 16px",
              background: isOpen ? brand.headerBg : "transparent",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: brand.accentColor,
                    boxShadow: `0 0 6px ${brand.accentColor}`,
                  }} />
                  <span style={{ color: brand.accentColor, fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>
                    {brand.name}
                  </span>
                  <span style={{
                    padding: "1px 6px",
                    background: brand.uiAccentDark,
                    borderRadius: 6,
                    color: brand.accentColor,
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: 0.5,
                  }}>
                    {brand.year}
                  </span>
                </div>
                <div style={{ color: "#6b7280", fontSize: 10, marginTop: 3 }}>{brand.tagline}</div>
              </div>
              <span style={{ color: brand.accentColor, fontSize: 16 }}>{isOpen ? "−" : "+"}</span>
            </div>

            {/* Expanded content */}
            {isOpen && (
              <div style={{ padding: "0 16px 14px" }}>
                <MiniSonar brand={brand} />

                <div style={{ marginTop: 12 }}>
                  {/* Modes */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "#6b7280", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                      Display Modes
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {brand.modes.map(mode => (
                        <span key={mode} style={{
                          padding: "3px 10px",
                          background: brand.uiAccentDark,
                          border: `1px solid ${brand.accentColor}30`,
                          borderRadius: 20,
                          color: brand.accentColor,
                          fontSize: 10,
                          fontWeight: 600,
                        }}>
                          {mode}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Key info rows */}
                  {[
                    { label: "UI Tell", value: brand.keyTell },
                    { label: "Range", value: brand.range },
                    { label: "Frequency", value: brand.frequency },
                    { label: "Fish Appearance", value: brand.fishAppearance },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <div style={{ color: "#4b5563", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>
                        {label}
                      </div>
                      <div style={{ color: "#d1d5db", fontSize: 11, lineHeight: 1.5 }}>{value}</div>
                    </div>
                  ))}

                  {/* Highlight feature */}
                  <div style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    background: brand.uiAccentDark,
                    border: `1px solid ${brand.accentColor}25`,
                    borderRadius: 8,
                  }}>
                    <div style={{ color: brand.accentColor, fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                      ✦ {brand.highlight}
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 11, lineHeight: 1.5 }}>{brand.highlightDesc}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Footer note */}
      <div style={{ color: "#374151", fontSize: 10, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        Simrad also supported (same Navico ActiveTarget 2 hardware).<br />
        Route: POST /api/live-sonar-analyze
      </div>
    </div>
  );
}
