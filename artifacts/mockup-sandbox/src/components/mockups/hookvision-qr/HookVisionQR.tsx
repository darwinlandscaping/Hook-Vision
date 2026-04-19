declare const __EXPO_DEV_DOMAIN__: string;

const EXPO_DEV_DOMAIN = __EXPO_DEV_DOMAIN__;

const apps = [
  {
    name: "HookVision WA",
    region: "WA / Kimberley",
    port: 25351,
    color: "#00d4aa",
    emoji: "🦈",
  },
  {
    name: "HookVision NQ",
    region: "NQ / Gulf Country",
    port: 25352,
    color: "#00b8e6",
    emoji: "🐟",
  },
  {
    name: "HookVision NT",
    region: "NT / Kakadu",
    port: 25353,
    color: "#ff9500",
    emoji: "🐊",
  },
];

function qrUrl(expoUrl: string, size = 260) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(expoUrl)}&bgcolor=ffffff&color=0a1628&margin=4`;
}

export default function HookVisionQR() {
  return (
    <div
      style={{
        background: "#0a1628",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        padding: "24px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ color: "#00d4aa", fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>
          Expo Go
        </div>
        <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>
          HookVision — Scan to Open
        </div>
        <div style={{ color: "#7a9ab5", fontSize: 11, lineHeight: 1.5 }}>
          1. Open Expo Go &nbsp;→&nbsp; tap <strong style={{ color: "#fff" }}>Scan QR Code</strong><br />
          2. If you see a password screen — shake phone → tap <strong style={{ color: "#ff9500" }}>Reload</strong>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {apps.map((app) => {
          const expoUrl = `exp://${EXPO_DEV_DOMAIN}:${app.port}`;
          return (
            <div
              key={app.port}
              style={{
                background: "#0e1e35",
                border: `2px solid ${app.color}55`,
                borderRadius: 16,
                padding: "18px 18px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: 220,
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 10 }}>{app.emoji}</div>
              <img
                src={qrUrl(expoUrl)}
                alt={`QR code for ${app.name}`}
                width={220}
                height={220}
                style={{
                  borderRadius: 8,
                  border: `2.5px solid ${app.color}`,
                  display: "block",
                  background: "#fff",
                }}
              />
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginTop: 12 }}>
                {app.name}
              </div>
              <div style={{ color: "#7a9ab5", fontSize: 11, marginTop: 2 }}>
                {app.region}
              </div>
              <div
                style={{
                  color: app.color,
                  fontSize: 9,
                  marginTop: 10,
                  fontFamily: "monospace",
                  background: "#060e1a",
                  padding: "5px 8px",
                  borderRadius: 6,
                  width: "100%",
                  boxSizing: "border-box",
                  textAlign: "center",
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                  userSelect: "all",
                }}
              >
                {expoUrl}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24, background: "#0e1e35", borderRadius: 10, padding: "12px 20px", maxWidth: 680, width: "100%", boxSizing: "border-box" }}>
        <div style={{ color: "#00d4aa", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          Troubleshooting
        </div>
        <div style={{ color: "#7a9ab5", fontSize: 11, lineHeight: 1.7 }}>
          <strong style={{ color: "#fff" }}>QR won't scan?</strong> Copy the exp:// URL below the code, open Expo Go and paste it in the address bar.<br />
          <strong style={{ color: "#fff" }}>Seeing old password screen?</strong> Shake your phone → tap <span style={{ color: "#ff9500" }}>Reload</span>, or close the app in Expo Go and scan again.<br />
          <strong style={{ color: "#fff" }}>Connection error?</strong> Make sure your phone is not on a corporate/school network that blocks custom ports.
        </div>
      </div>

      <div style={{ color: "#3d5a73", fontSize: 10, marginTop: 16, textAlign: "center" }}>
        Replit Expo Dev Server · Valid while workspace is open
      </div>
    </div>
  );
}
