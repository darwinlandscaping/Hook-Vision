import { useEffect, useMemo, useState } from "react";

type AppLink = {
  name: string;
  sub: string;
  key: string;
  port: number;
  color: string;
  emoji: string;
};

const APPS: AppLink[] = [
  {
    key: "wa",
    name: "HookVision WA",
    sub: "Kimberley / Broome / Ord River",
    port: 25351,
    color: "#1d6fcf",
    emoji: "🦈",
  },
  {
    key: "nq",
    name: "HookVision NQ",
    sub: "Gulf Country / Karumba / Norman River",
    port: 25352,
    color: "#16a34a",
    emoji: "🐟",
  },
  {
    key: "nt",
    name: "HookVision NT",
    sub: "Kakadu / Darwin / Mary River",
    port: 25353,
    color: "#d97706",
    emoji: "🐊",
  },
];

function sanitizeHost(value: string): string {
  return value.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/:\d+$/, "");
}

function deriveExpoHost(host: string): string {
  const cleaned = sanitizeHost(host);

  if (!cleaned || cleaned.includes(".expo.") || cleaned === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(cleaned)) {
    return cleaned;
  }

  const parts = cleaned.split(".");
  if (parts.length >= 2) {
    return [parts[0], "expo", ...parts.slice(1)].join(".");
  }

  return cleaned;
}

function getInitialExpoHost(): string {
  if (typeof window === "undefined") return "";

  const queryHost = new URLSearchParams(window.location.search).get("expoHost");
  if (queryHost) return sanitizeHost(queryHost);

  const savedHost = window.localStorage.getItem("hookvision-expo-host");
  if (savedHost) return sanitizeHost(savedHost);

  return deriveExpoHost(window.location.hostname);
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
  return Promise.resolve();
}

export default function GetApps() {
  const [expoHost, setExpoHost] = useState(getInitialExpoHost);
  const [copyState, setCopyState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (expoHost) {
      window.localStorage.setItem("hookvision-expo-host", expoHost);
    } else {
      window.localStorage.removeItem("hookvision-expo-host");
    }
  }, [expoHost]);

  const browserHost = typeof window === "undefined" ? "" : window.location.hostname;
  const normalizedExpoHost = useMemo(() => sanitizeHost(expoHost), [expoHost]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: 28, textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎣</div>
        <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0 }}>HookVision phone launcher</h1>
        <p style={{ color: "#888", fontSize: 14, margin: "8px 0 0", lineHeight: 1.5 }}>
          Open this page on your phone, then tap your region to jump straight into Expo Go.
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 420, background: "#101729", borderRadius: 16, padding: 18, boxSizing: "border-box", marginBottom: 18, boxShadow: "0 10px 40px rgba(0,0,0,0.24)" }}>
        <label htmlFor="expo-host" style={{ display: "block", color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          Expo host
        </label>
        <input
          id="expo-host"
          type="text"
          value={expoHost}
          onChange={(event) => setExpoHost(sanitizeHost(event.target.value))}
          placeholder="your-project.expo.spock.replit.dev"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 12,
            border: "1px solid #334155",
            background: "#0a0f1e",
            color: "#fff",
            fontSize: 15,
            padding: "12px 14px",
            outline: "none",
          }}
        />
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
          Detected browser host: <span style={{ color: "#fff" }}>{browserHost || "unknown"}</span>
          <br />
          If the buttons stop opening after Cursor changes domains, edit this field once and the page will remember it.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 420 }}>
        {APPS.map((app) => {
          const expoUrl = normalizedExpoHost ? `exp://${normalizedExpoHost}:${app.port}` : "";
          const browserPreviewUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/proxy/${app.key}/`;

          return (
            <div
              key={app.port}
              style={{
                background: "#111827",
                borderRadius: 18,
                padding: 12,
                boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
              }}
            >
              <a
                href={expoUrl || undefined}
                style={{
                  display: "block",
                  background: app.color,
                  borderRadius: 14,
                  padding: "20px 20px",
                  textDecoration: "none",
                  boxShadow: `0 4px 24px ${app.color}55`,
                  opacity: expoUrl ? 1 : 0.5,
                  pointerEvents: expoUrl ? "auto" : "none",
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

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() =>
                    copyText(expoUrl).then(() => {
                      setCopyState(app.key);
                      window.setTimeout(() => setCopyState((current) => (current === app.key ? null : current)), 1800);
                    })
                  }
                  disabled={!expoUrl}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#fff",
                    padding: "10px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    opacity: expoUrl ? 1 : 0.5,
                  }}
                >
                  {copyState === app.key ? "Copied" : "Copy Expo link"}
                </button>
                <a
                  href={browserPreviewUrl}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#cbd5e1",
                    padding: "10px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Browser preview
                </a>
              </div>

              <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 10, wordBreak: "break-all" }}>
                {expoUrl || "Enter an Expo host above to enable this launcher."}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 26, padding: "14px 20px", background: "#1a2035", borderRadius: 12, maxWidth: 420, width: "100%", boxSizing: "border-box" }}>
        <p style={{ color: "#aaa", fontSize: 13, margin: 0, lineHeight: 1.6, textAlign: "center" }}>
          Best on phone: open this page in Safari/Chrome, tap your region, then approve the handoff to <strong style={{ color: "#fff" }}>Expo Go</strong>.
          <br /><br />
          If Expo Go does not open, copy the Expo link and paste it into your phone notes/messages, then tap it there.
        </p>
      </div>
    </div>
  );
}
