export default function GetApps() {
  const domain = "898f5a0e-eba6-4a78-b40d-d78f0539d56e-00-o6803yqna0ig.expo.spock.replit.dev";

  const apps = [
    {
      name: "HookVision WA",
      sub: "Kimberley / Broome / Ord River",
      port: 25351,
      color: "#1d6fcf",
      emoji: "🦈",
    },
    {
      name: "HookVision NQ",
      sub: "Gulf Country / Karumba / Norman River",
      port: 25352,
      color: "#16a34a",
      emoji: "🐟",
    },
    {
      name: "HookVision NT",
      sub: "Kakadu / Darwin / Mary River",
      port: 25353,
      color: "#d97706",
      emoji: "🐊",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎣</div>
        <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0 }}>HookVision</h1>
        <p style={{ color: "#888", fontSize: 14, margin: "6px 0 0" }}>Tap your region to open in Expo Go</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 400 }}>
        {apps.map((app) => (
          <a
            key={app.port}
            href={`exp://${domain}:${app.port}`}
            style={{
              display: "block",
              background: app.color,
              borderRadius: 16,
              padding: "20px 24px",
              textDecoration: "none",
              boxShadow: `0 4px 24px ${app.color}55`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 36 }}>{app.emoji}</span>
              <div>
                <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{app.name}</div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 3 }}>{app.sub}</div>
              </div>
            </div>
          </a>
        ))}
      </div>

      <div style={{ marginTop: 36, padding: "14px 20px", background: "#1a2035", borderRadius: 12, maxWidth: 400, width: "100%" }}>
        <p style={{ color: "#aaa", fontSize: 13, margin: 0, lineHeight: 1.6, textAlign: "center" }}>
          Tap a button above → Expo Go opens automatically with the latest version of the app.
          <br /><br />
          <strong style={{ color: "#fff" }}>Expo Go must be installed</strong> on the phone.
          If prompted to open in Expo Go, tap <strong style={{ color: "#4ade80" }}>Open</strong>.
        </p>
      </div>
    </div>
  );
}
