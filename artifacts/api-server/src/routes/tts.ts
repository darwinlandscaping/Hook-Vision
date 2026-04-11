import { Router } from "express";
import https from "https";

const router = Router();

// Google Translate TTS — unofficial but no API key required.
// 200-char limit per request; we chunk long texts into sentences.
function gttsUrl(text: string, lang: string): string {
  const params = new URLSearchParams({
    ie: "UTF-8",
    q: text,
    tl: lang.split("-")[0],
    client: "tw-ob",
    ttsspeed: "0.9",
  });
  return `https://translate.google.com/translate_tts?${params.toString()}`;
}

async function fetchGTTS(text: string, lang: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = gttsUrl(text, lang);
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://translate.google.com/",
          "Accept": "*/*",
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Google TTS HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("TTS timeout")); });
  });
}

function chunkText(text: string, maxLen = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((current + " " + trimmed).trim().length <= maxLen) {
      current = (current + " " + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      current = trimmed.slice(0, maxLen);
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

async function handleTTS(
  text: string | undefined,
  lang: string,
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1]
) {
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  try {
    const chunks = chunkText(text);
    const buffers = await Promise.all(chunks.map((c) => fetchGTTS(c, lang)));
    const combined = Buffer.concat(buffers);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": combined.length.toString(),
      "Cache-Control": "no-store",
    });
    res.send(combined);
  } catch (err) {
    req.log.error({ err }, "TTS request failed");
    res.status(500).json({ error: "Voice generation failed." });
  }
}

// POST — used by web (Web Audio API fetches ArrayBuffer)
router.post("/tts", async (req, res) => {
  const { text, lang = "en" } = req.body as { text?: string; lang?: string };
  await handleTTS(text, lang, req, res);
});

// GET — used by native (expo-av streams directly from URL)
router.get("/tts", async (req, res) => {
  const { text, lang = "en" } = req.query as { text?: string; lang?: string };
  await handleTTS(text, lang, req, res);
});

export default router;
