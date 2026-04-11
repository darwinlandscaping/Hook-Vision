import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/tts", async (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  if (text.length > 4096) {
    res.status(400).json({ error: "text too long" });
    return;
  }

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: text,
      speed: 0.92,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "no-store",
    });
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "TTS request failed");
    res.status(500).json({ error: "Voice generation failed." });
  }
});

export default router;
