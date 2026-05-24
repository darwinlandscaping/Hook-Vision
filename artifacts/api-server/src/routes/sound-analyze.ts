import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getModel } from "../lib/models.js";
import { logger } from "../lib/logger.js";
const router = Router();

const SONAR_PROMPT = `You are an expert Australian fishing guide and barramundi biologist specialising in tropical Northern Australian waters (WA Kimberley, NT, NQ). You are listening to ambient audio captured from a boat on the water.

SOUNDS TO IDENTIFY — barra and surface activity:
• Barra buff / surface gulp — single sharp THWACK or hollow PLOP — 1-2 barra feeding at surface
• Barra roll — heavy rolling splash, brief — large fish rolling near surface
• Surface spray / bait school — multiple rapid splashes — bait being herded to surface
• Barra boil — sustained bubbling/churning — multiple barra corralling bait
• General splash — non-specific water disturbance

For direction, estimate from audio cues. Use clock-face: 12 o'clock = straight ahead, 3 = right, 9 = left, 6 = behind.

Return ONLY valid JSON — no markdown, no code fences:
{
  "detected": true|false,
  "species": "Barramundi",
  "event": "surface buff"|"barra roll"|"surface spray"|"barra boil"|"unknown",
  "direction": "12 o'clock"|"3 o'clock"|"9 o'clock"|"6 o'clock"|"11 o'clock"|"2 o'clock"|"1 o'clock"|"10 o'clock",
  "distance": "~2m"|"~5m"|"~8m"|"~12m"|"~20m"|"unclear",
  "confidence": 0-100,
  "narration": "One vivid laconic Australian fishing guide sentence — practical, immediate. E.g.: That's a barra buff — nine o'clock, about five metres. Surface feeder. Go now.",
  "plan": "One action sentence: exact cast instruction — lure, clock direction, distance, retrieve."
}

If nothing fishing-related is detected return { "detected": false, "confidence": 0 }.`;

const BIRD_PROMPT = `You are an expert ornithologist and Australian tropical fishing guide specialising in WA Kimberley, NT, and NQ coastal waters.

You are listening to ambient audio captured near tropical Australian water. Identify bird calls from this catalog:

• Frigatebird — harsh rattling "kraaaak" or "wok-wok-wok" — HIGH fishing indicator
• Crested Tern — sharp "kirri-kirri" or "kree-kree" — VERY HIGH fishing indicator
• Little Tern — rapid high "kik-kik-kik" — HIGH fishing indicator
• Brown Booby — guttural grunts "urrk" or "uh-uh-uh" — VERY HIGH fishing indicator
• Masked Booby — deep grunts, similar to Brown Booby — VERY HIGH fishing indicator
• Osprey — high-pitched whistling "kyew-kyew-kyew" or "cheep-cheep" — HIGH fishing indicator
• Brahminy Kite — squealing mewing "peeee-ah" or "pee-ah-wee" — MODERATE fishing indicator
• Australian Pelican — deep low grunts, mostly silent — MODERATE fishing indicator
• Little Black Cormorant — low guttural croaking — MODERATE fishing indicator
• Silver Gull / Seagull — screeching "mew-mew" — LOW (scavenger)
• Welcome Swallow — rapid twittering — NONE (insect hunter)

For direction, estimate from audio cues. Clock-face: 12 = ahead, 3 = right, 9 = left, 6 = behind.

Return ONLY valid JSON — no markdown, no code fences:
{
  "detected": true|false,
  "species": "common species name",
  "fishingIndicator": "VERY HIGH"|"HIGH"|"MODERATE"|"LOW"|"NONE",
  "behavior": "diving"|"aerial"|"perched"|"other",
  "direction": "12 o'clock"|"3 o'clock"|"9 o'clock"|"6 o'clock"|"overhead"|"2 o'clock"|"10 o'clock",
  "distance": "~10m"|"~20m"|"~30m"|"overhead"|"distant"|"unclear",
  "confidence": 0-100,
  "narration": "2 sentences: laconic Australian fishing guide — identify the bird, what it signals right now.",
  "plan": "One action sentence — what the angler should do immediately based on this call."
}

If no recognisable bird call detected return { "detected": false, "confidence": 0 }.`;

router.post("/sound/analyze", async (req, res) => {
  const {
    audioBase64,
    audioFormat = "m4a",
    screenType = "sonar",
    context = {},
  } = req.body as {
    audioBase64?: string;
    audioFormat?: string;
    screenType?: "sonar" | "bird";
    context?: { timeOfDay?: string; region?: string };
  };

  if (!audioBase64) {
    res.status(400).json({ error: "audioBase64 required" });
    return;
  }

  const systemPrompt = screenType === "bird" ? BIRD_PROMPT : SONAR_PROMPT;
  const contextNote = [
    context.timeOfDay ? `Time: ${context.timeOfDay}` : "",
    context.region ? `Region: ${context.region}` : "Region: Northern Australia",
  ].filter(Boolean).join(". ");

  let transcription = "";

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const mimeType = audioFormat === "wav" ? "audio/wav" : audioFormat === "mp3" ? "audio/mpeg" : "audio/mp4";
    const file = new File([audioBuffer], `audio.${audioFormat}`, { type: mimeType });

    const whisperPrompt = screenType === "bird"
      ? "Audio near tropical Australian water. Note any bird calls — frigatebird, tern, booby, osprey, kite, pelican, cormorant, gull."
      : "Audio from boat on tropical Australian water. Note any water sounds — splashing, surface strikes, fish jumping, boiling water.";

    const result = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      response_format: "text",
      prompt: whisperPrompt,
    });

    transcription = typeof result === "string" ? result : ((result as Record<string, unknown>).text as string) ?? "";
  } catch (err) {
    logger.warn({ err: String(err) }, "sound/analyze: Whisper failed, using context only");
    transcription = "[audio not transcribed]";
  }

  try {
    const userContent = [
      contextNote,
      `Audio content: "${transcription || "(silent or unclear)"}"`,
      `Analyse for ${screenType === "bird" ? "bird calls from the catalog" : "barra surface activity"}. Return JSON.`,
    ].join("\n");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);

    const response = await openai.chat.completions.create(
      {
        model: getModel("top"),
        max_completion_tokens: 250,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userContent },
        ],
      },
      { signal: ctrl.signal },
    );
    clearTimeout(timer);

    const raw   = response.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      res.status(500).json({ error: "AI parse error", raw });
      return;
    }

    res.json(parsed);
  } catch (err) {
    logger.error({ err: String(err) }, "sound/analyze: GPT failed");
    res.status(500).json({ error: "Sound analysis failed", detail: String(err) });
  }
});

export default router;
