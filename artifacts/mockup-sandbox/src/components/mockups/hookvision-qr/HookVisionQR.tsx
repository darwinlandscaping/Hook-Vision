const EXPO_DEV_DOMAIN = "898f5a0e-eba6-4a78-b40d-d78f0539d56e-00-o6803yqna0ig.expo.spock.replit.dev";

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

function qrUrl(expoUrl: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(expoUrl)}&bgcolor=ffffff&color=0a1628&margin=2`;
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
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ color: "#00d4aa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>
          Expo Go
        </div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>
          HookVision — Scan to Open
        </div>
        <div style={{ color: "#7a9ab5", fontSize: 12, marginTop: 6 }}>
          Open Expo Go on your phone, tap "Scan QR Code"
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {apps.map((app) => {
          const expoUrl = `exp://${EXPO_DEV_DOMAIN}:${app.port}`;
          return (
            <div
              key={app.port}
              style={{
                background: "#0e1e35",
                border: `1.5px solid ${app.color}33`,
                borderRadius: 16,
                padding: "20px 20px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: 200,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{app.emoji}</div>
              <img
                src={qrUrl(expoUrl)}
                alt={`QR code for ${app.name}`}
                width={200}
                height={200}
                style={{
                  borderRadius: 8,
                  border: `2px solid ${app.color}`,
                  display: "block",
                }}
              />
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginTop: 14 }}>
                {app.name}
              </div>
              <div style={{ color: "#7a9ab5", fontSize: 11, marginTop: 3 }}>
                {app.region}
              </div>
              <div
                style={{
                  color: app.color,
                  fontSize: 10,
                  marginTop: 8,
                  fontFamily: "monospace",
                  background: "#060e1a",
                  padding: "4px 8px",
                  borderRadius: 4,
                  wordBreak: "break-all",
                  maxWidth: 190,
                  textAlign: "center",
                }}
              >
                :{app.port}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ color: "#3d5a73", fontSize: 11, marginTop: 28, textAlign: "center" }}>
        Password: <span style={{ color: "#7a9ab5" }}>Pepper73</span> · Replit Expo Dev Server · Valid while workspace is open
      </div>
    </div>
  );
}
