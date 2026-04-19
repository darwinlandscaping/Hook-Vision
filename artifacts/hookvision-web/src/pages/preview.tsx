import { useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const APPS = [
  { key: "wa", label: "HookVision WA", region: "WA / Kimberley", color: "#00d4aa", emoji: "🦈" },
  { key: "nq", label: "HookVision NQ", region: "NQ / Gulf Country", color: "#00b8e6", emoji: "🐟" },
  { key: "nt", label: "HookVision NT", region: "NT / Kakadu", color: "#ff9500", emoji: "🐊" },
];

export default function Preview() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", color: "#fff", fontFamily: "Inter, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ color: "#00d4aa", fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>
            App Preview
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>HookVision — Live Browser Preview</h1>
          <p style={{ color: "#7a9ab5", fontSize: 13, marginTop: 8 }}>
            Running inside Replit — tap an app to load it in the phone frame below
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
          {APPS.map((app) => (
            <button
              key={app.key}
              onClick={() => setActive(app.key)}
              style={{
                background: active === app.key ? app.color : "#0e1e35",
                color: active === app.key ? "#000" : "#fff",
                border: `2px solid ${app.color}`,
                borderRadius: 12,
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              <span>{app.emoji}</span>
              <div style={{ textAlign: "left" }}>
                <div>{app.label}</div>
                <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>{app.region}</div>
              </div>
            </button>
          ))}
        </div>

        {active ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ color: "#7a9ab5", fontSize: 12 }}>
              Loading {APPS.find(a => a.key === active)?.label} — tap inside to interact
            </div>
            <div
              style={{
                background: "#1a1a2e",
                border: `2px solid ${APPS.find(a => a.key === active)?.color}`,
                borderRadius: 44,
                padding: "12px 6px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                position: "relative",
              }}
            >
              <div style={{ width: 390, height: 844, borderRadius: 36, overflow: "hidden", background: "#0a1628" }}>
                <iframe
                  key={active}
                  src={`${BASE}/proxy/${active}/`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title={APPS.find(a => a.key === active)?.label}
                  allow="camera; microphone; geolocation"
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#3d5a73", textAlign: "center" }}>
              Direct URL: <code style={{ color: "#00d4aa" }}>{BASE}/proxy/{active}/</code>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#3d5a73" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>☝️</div>
            <div style={{ fontSize: 14 }}>Select an app above to preview it</div>
          </div>
        )}
      </div>
    </div>
  );
}
