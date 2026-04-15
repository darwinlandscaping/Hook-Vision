import { Router } from "express";
// @ts-ignore — msedge-tts ships CommonJS only
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const router = Router();

// ─── Voice + prosody per character ────────────────────────────────────────────
// Available high-quality Neural voices confirmed via MsEdgeTTS.getVoices():
//   en-AU: WilliamMultilingualNeural (M), NatashaNeural (F)
//   en-NZ: MitchellNeural (M), MollyNeural (F)
//   en-GB: RyanNeural (M), ThomasNeural (M), LibbyNeural (F), SoniaNeural (F)
//   en-US: GuyNeural, ChristopherNeural, EricNeural, AndrewNeural,
//           BrianNeural, RogerNeural, SteffanNeural (M) / AvaNeural, AriaNeural,
//           JennyNeural, EmmaNeural, MichelleNeural (F)

interface VoiceConfig {
  voice: string;
  ratePct: number;   // %: -50 = very slow, 0 = normal, +50 = fast
  pitchHz: number;   // Hz: negative = deeper, positive = higher
}

const CHARACTER_VOICE: Record<string, VoiceConfig> = {
  // ── True Australians — all use the one confirmed AU male / AU female ───────
  AUSSIE:       { voice: "en-AU-WilliamMultilingualNeural", ratePct: -8,  pitchHz: -5  }, // laconic WA/Kimberley barra legend
  BENAUD:       { voice: "en-AU-WilliamMultilingualNeural", ratePct: -20, pitchHz: -10 }, // measured cricket poet
  CHOPPER:      { voice: "en-AU-WilliamMultilingualNeural", ratePct: -5,  pitchHz: -18 }, // gravelly Melbourne
  IRWIN:        { voice: "en-AU-WilliamMultilingualNeural", ratePct: +20, pitchHz: +8  }, // enthusiastic Crikey!
  DUNDEE:       { voice: "en-AU-WilliamMultilingualNeural", ratePct: -12, pitchHz: -3  }, // laid-back outback
  BOGAN:        { voice: "en-AU-WilliamMultilingualNeural", ratePct: +18, pitchHz: +5  }, // fully sick lad
  WIFE:         { voice: "en-AU-NatashaNeural",             ratePct: +6,  pitchHz: +5  }, // expressive nagging AU female

  // ── British ───────────────────────────────────────────────────────────────
  ATTENBOROUGH: { voice: "en-GB-RyanNeural",      ratePct: -22, pitchHz: -12 }, // reverent BBC authority
  GRYLLS:       { voice: "en-GB-RyanNeural",      ratePct: +8,  pitchHz: +2  }, // breathless SAS
  RAMSAY:       { voice: "en-GB-RyanNeural",      ratePct: +12, pitchHz: -5  }, // intense rapid-fire chef
  CONNERY:      { voice: "en-GB-ThomasNeural",    ratePct: -12, pitchHz: -15 }, // deep deliberate Scottish
  SPARROW:      { voice: "en-GB-RyanNeural",      ratePct: -8,  pitchHz: +4  }, // eccentric pirate

  // ── American ──────────────────────────────────────────────────────────────
  BURGUNDY:     { voice: "en-US-GuyNeural",           ratePct: 0,   pitchHz: -5  }, // pompous anchor man
  MORGAN:       { voice: "en-US-ChristopherNeural",   ratePct: -20, pitchHz: -20 }, // profound cosmos depth
  ARNIE:        { voice: "en-US-ChristopherNeural",   ratePct: -22, pitchHz: -22 }, // Austrian Oak bass
  BOBROSS:      { voice: "en-US-AndrewNeural",        ratePct: -25, pitchHz: -4  }, // soothing painter
  TYSON:        { voice: "en-US-EricNeural",          ratePct: +5,  pitchHz: +8  }, // Baddest Man
  SAMUEL:       { voice: "en-US-ChristopherNeural",   ratePct: +6,  pitchHz: -8  }, // commanding intensity
  JEFF:         { voice: "en-US-AndrewNeural",        ratePct: -15, pitchHz: +5  }, // contemplative Goldblum
  YODA:         { voice: "en-US-ChristopherNeural",   ratePct: -28, pitchHz: -12 }, // ancient wisdom
};

// For non-English, use the best locale-matched male voice
const LANG_FALLBACK_VOICE: Record<string, string> = {
  "en-AU": "en-AU-WilliamMultilingualNeural",
  "ja-JP": "ja-JP-KeitaNeural",
  "zh-CN": "zh-CN-YunyangNeural",
  "id-ID": "id-ID-ArdiNeural",
  "de-DE": "de-DE-ConradNeural",
  "fr-FR": "fr-FR-HenriNeural",
  "es-ES": "es-ES-AlvaroNeural",
  "ko-KR": "ko-KR-InJoonNeural",
  "th-TH": "th-TH-NiwatNeural",
  "vi-VN": "vi-VN-NamMinhNeural",
  "pt-BR": "pt-BR-AntonioNeural",
};

// ─── Build SSML with prosody ──────────────────────────────────────────────────
function buildSSML(text: string, voice: string, ratePct: number, pitchHz: number): string {
  const rateStr  = ratePct === 0 ? "0%"  : ratePct  > 0 ? `+${ratePct}%`  : `${ratePct}%`;
  const pitchStr = pitchHz === 0 ? "0Hz" : pitchHz > 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='${voice}'>
    <prosody rate='${rateStr}' pitch='${pitchStr}'>${safe}</prosody>
  </voice>
</speak>`;
}

// ─── TTS handler ──────────────────────────────────────────────────────────────
async function handleTTS(
  text: string | undefined,
  character: string,
  lang: string,
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1]
) {
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const isEnglish = lang.startsWith("en");
  const config    = isEnglish ? (CHARACTER_VOICE[character] ?? CHARACTER_VOICE.AUSSIE) : null;
  const voice     = config ? config.voice : (LANG_FALLBACK_VOICE[lang] ?? "en-AU-WilliamMultilingualNeural");
  const ratePct   = config?.ratePct ?? 0;
  const pitchHz   = config?.pitchHz ?? 0;

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const ssml = buildSSML(text.slice(0, 2000), voice, ratePct, pitchHz);
    const { audioStream } = await tts.rawToStream(ssml);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (c: Buffer) => chunks.push(c));
      audioStream.on("end", resolve);
      audioStream.on("error", reject);
    });

    const combined = Buffer.concat(chunks);
    if (combined.length === 0) throw new Error("Empty audio response from Edge TTS");

    res.set({
      "Content-Type":   "audio/mpeg",
      "Content-Length": combined.length.toString(),
      "Cache-Control":  "no-store",
    });
    res.send(combined);
  } catch (err) {
    req.log.error({ err }, "Edge TTS request failed");
    res.status(500).json({ error: "Voice generation failed." });
  }
}

// POST — web
router.post("/tts", async (req, res) => {
  const { text, lang = "en-AU", character = "AUSSIE" } =
    req.body as { text?: string; lang?: string; character?: string };
  await handleTTS(text, character, lang, req, res);
});

// GET — native (expo-audio streams directly from URL)
router.get("/tts", async (req, res) => {
  const { text, lang = "en-AU", character = "AUSSIE" } =
    req.query as { text?: string; lang?: string; character?: string };
  await handleTTS(text, character, lang, req, res);
});

export default router;
