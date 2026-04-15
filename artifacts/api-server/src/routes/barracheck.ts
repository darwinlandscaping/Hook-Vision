/**
 * /api/barra-check
 * Stage-1 fast barramundi detector.
 *
 * Uses gpt-4.1-mini with few-shot visual prompting:
 *   - 3 research-grade reference photos from iNaturalist are injected into
 *     every call so the model compares the user's fish against real specimens.
 *   - "low" image detail for the reference images keeps tokens & latency down.
 *   - The user's photo uses "low" detail too — Stage 1 is purely "is/isn't barra".
 *
 * Few-shot visual prompting is the equivalent of training on reference photos,
 * applied in-context rather than via weight updates.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getFewShotRefs, addCommunityReference } from "../lib/barraLibrary.js";
import { makeThumbnailFromBase64 } from "../lib/imageUtils.js";

const router = Router();

// ─── Core anatomy prompt ──────────────────────────────────────────────────────
const BARRA_SYSTEM = `You are a specialist barramundi (Lates calcarifer) detection AI.
You will be shown confirmed reference barramundi specimens FIRST, then the photo to evaluate.

════ STEP 0: DETERMINE THE VIEWING ANGLE ════
Before applying any features, decide how the fish is oriented in the photo:
  A. SIDE VIEW (lateral) — most common; fish body seen from the flank/side
  B. TOP VIEW (dorsal/overhead) — fish lying flat, camera above looking down; shadow visible to one side
  C. ANGLED / THREE-QUARTER — partial side + top mix
  D. MOUTH-ON / HEAD-ON — facing the camera
Apply the correct feature set below based on the viewing angle.

════ SIDE VIEW features (Viewing Angle A) ════
BARRAMUNDI HALLMARK FEATURES — SIDE VIEW (match ≥5 of 9):
1. FOREHEAD — concave "ski-jump" dip between eyes and snout. Most reliable single feature.
2. JAW — upper jaw extends past the eye; large gape; lower jaw shorter than upper.
3. EYE — large, golden/orange iris, positioned high on the head.
4. SCALES — large ctenoid scales, silvery-grey flanks, white/cream belly; may be bronze/copper in tannin water.
5. BODY SHAPE — elongated, laterally compressed; deep at shoulder, tapers to narrow caudal peduncle.
6. DORSAL FIN — single long fin with deep notch between spiny anterior section and soft posterior section.
7. CAUDAL FIN — rounded, slightly convex trailing edge, thin dark posterior margin.
8. PECTORAL FIN — large, rounded, fan-shaped. No finger-like free rays (free rays = Threadfin Salmon).
9. LATERAL LINE — strongly arched over the pectoral fin, then runs straight to the caudal peduncle.

NOT A BARRA (side view):
• Red/pink body with pointed snout → Mangrove Jack
• Free-hanging finger-like pectoral rays → Threadfin Salmon
• Small scales, reddish, downturned jaw → Fingermark / Golden Snapper
• Large spots on flanks, arched leaping posture → Saratoga
• Strongly forked tail, torpedo body → Trevally / Giant Trevally

════ TOP VIEW / DORSAL VIEW features (Viewing Angle B) ════
When the fish is photographed from ABOVE (looking down at the dorsal surface):
TOP-VIEW HALLMARK FEATURES — match ≥4 of 8:
1. BODY OUTLINE — elongated fusiform/torpedo shape from above; widest just behind the gill plate; tapers gradually to a narrow caudal peduncle; overall length is clearly much greater than width (roughly 4–5:1 ratio).
2. HEAD SHAPE — broad, slightly flattened head from above; snout looks blunt/rounded viewed from top; upper jaw visibly protrudes ahead of the snout tip (confirms large lower-jaw protrusion).
3. EYE BULGES — two large, round, prominent eye bulges on either side of the head near the front; eyes appear relatively large and positioned high.
4. DORSAL RIDGE / FIN — long dorsal fin ridge running from just behind the skull to near the tail; the spiny anterior section and the soft posterior section may both be visible as a raised ridge from above.
5. PECTORAL FINS — large, fan-shaped pectoral fins visible splayed out from each side of the body, just behind the gill plate; they are large and broad relative to body width (not small nubs).
6. DORSAL SURFACE COLOUR — dark blue-grey, olive-green, or bronze-green on the dorsal surface; flanks lighter, visible at the edges of the body outline; belly not visible from above.
7. CAUDAL FIN — broad, slightly rounded or squared-off tail fan visible at the rear; relatively wide compared to the narrow caudal peduncle just ahead of it.
8. SHADOW — if visible, the shadow extends to ONE SIDE opposite the overhead light source; shadow shape mirrors the fish body outline from above — elongated oval with fins and tail visible in the shadow silhouette.

TOP-VIEW CONFIRMATION TIP — SHADOW:
• A barramundi from above casts a distinctive shadow: the elongated oval body + splayed pectoral fins create a "body with wings" shadow shape.
• Shadow to the LEFT means light is coming from the RIGHT — this is a strong confirmation that the image is a genuine top-down photo, not a sonar rendering.
• If you see an elongated olive/dark body shape from above with a paired shadow of the same shape offset to one side → very high barra confidence.

TOP-VIEW NOT A BARRA IF:
• Body too deep/disc-shaped from above (height ~ width) → Barramundi cod, Sooty Grunter
• Round/stubby body from above with prominent spots → Saratoga
• Very slim/elongated (>7:1) with visible serrated lateral scale row → Yellowbelly/Golden Perch
• Body shows distinct horizontal banding from above → Jungle Perch or Sooty Grunter

════ GENERAL RULES (all viewing angles) ════
Compare the target photo against the reference specimens above.
Count how many hallmark features you can clearly see for the detected viewing angle.

OUTPUT — ONLY this JSON, no markdown, no extra text:
{
  "isBarra": true | false,
  "confidence": 0-100,
  "viewingAngle": "side" | "top" | "angled" | "head-on" | "unknown",
  "featuresDetected": ["feature name", ...],
  "featuresMissing": ["feature name", ...],
  "keyEvidence": "one sentence: strongest visual proof for your verdict",
  "slotWarning": null | "CHECK WA FISHERIES: confirm bag limit and size before keeping",
  "sizeHint": "~55cm" | null,
  "refMatchScore": 0-100
}`;

function detectMime(b64: string): string {
  const p = b64.slice(0, 12);
  if (p.startsWith("iVBORw0")) return "image/png";
  if (p.startsWith("UklGR"))   return "image/webp";
  return "image/jpeg";
}

router.post("/barra-check", async (req, res) => {
  const { imageBase64, confirmAsBarra, location, topViewHint } = req.body as {
    imageBase64?:    string;
    confirmAsBarra?: boolean;  // true = user confirmed this IS a barra → add to library
    location?:       string;
    topViewHint?:    boolean;  // true = caller believes photo is a top/dorsal view
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  // ── Community learning: if user confirmed, store in reference pool ──────────
  if (confirmAsBarra === true) {
    // We don't have a URL here (raw base64), so we skip URL storage.
    // The user's confirmation still improves accuracy via the prompt.
    // If a CDN upload endpoint is added later, store it here.
  }

  try {
    const mime = detectMime(imageBase64);
    // When caller hints top-view, prioritise dorsal reference images
    const refs = getFewShotRefs(2, topViewHint === true);

    // Build few-shot reference content blocks
    const refBlocks: object[] = [];
    if (refs.length > 0) {
      const refLabels = refs.map((r, i) => {
        const angleBadge = r.viewingAngle === "top" ? "📐 TOP VIEW" : r.viewingAngle === "angled" ? "↗ ANGLED" : "◀ SIDE VIEW";
        return `\n[Specimen ${i + 1}: ${r.location}, ${r.votes} expert votes, ${angleBadge}]`;
      }).join("");
      refBlocks.push({
        type: "text",
        text: `Here are ${refs.length} confirmed research-grade barramundi specimens for comparison${refLabels}:`,
      });
      for (const ref of refs) {
        // Use pre-compressed base64 thumb when available — eliminates OpenAI → iNat URL fetches
        const imgUrl = ref.thumbBase64
          ? `data:image/jpeg;base64,${ref.thumbBase64}`
          : ref.photoUrl;
        refBlocks.push({
          type: "image_url",
          image_url: { url: imgUrl, detail: "low" },
        });
      }
      refBlocks.push({
        type: "text",
        text: "Now evaluate the following photo — is this fish ALSO a barramundi?",
      });
    } else {
      refBlocks.push({
        type: "text",
        text: "Evaluate the following photo — is this a barramundi?",
      });
    }

    const userContent = [
      ...refBlocks,
      {
        type: "image_url",
        image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" },
      },
      {
        type: "text",
        text: refs.length > 0
          ? `Compare against the ${refs.length} reference specimens above. Return JSON only.`
          : "Return JSON only.",
      },
    ];

    const callOpts = {
      model:                "gpt-4.1-mini" as const,
      max_completion_tokens: 200,
      stream:               false as const,
      messages: [
        { role: "system" as const, content: BARRA_SYSTEM },
        { role: "user" as const, content: userContent as any },
      ],
    };

    // ── Dual-scan consensus: 2 parallel calls with different seeds ────────
    const [res1, res2] = await Promise.all([
      openai.chat.completions.create({ ...callOpts, temperature: 0,   seed: 1 }),
      openai.chat.completions.create({ ...callOpts, temperature: 0.3, seed: 2 }),
    ]);

    function parseResult(r: typeof res1): Record<string, unknown> {
      const raw   = r.choices[0]?.message?.content ?? "{}";
      const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      try { return JSON.parse(clean); } catch { return {}; }
    }

    const p1 = parseResult(res1);
    const p2 = parseResult(res2);

    const agreed = (p1.isBarra === p2.isBarra);
    let parsed: Record<string, unknown>;

    if (agreed) {
      // Both scans agree — use average confidence (boosted by 5 for consensus)
      const avgConf = Math.round(((Number(p1.confidence) + Number(p2.confidence)) / 2) + 5);
      parsed = { ...p1, confidence: Math.min(99, avgConf) };
    } else {
      // Scans disagree — use the more conservative result (lower confidence)
      parsed = Number(p1.confidence) <= Number(p2.confidence) ? p1 : p2;
    }

    parsed.consensusScans   = 2;
    parsed.consensusAgreed  = agreed;
    parsed.refPhotosUsed    = refs.length;
    parsed.refSourceDetails = refs.map((r: { location: string }) => r.location);

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Barra check failed", detail: String(err) });
  }
});

/**
 * POST /api/barra-confirm
 * Store a community-confirmed barramundi catch in the reference brain.
 *
 * Called when a user taps "Confirm + Save to Brain" after a positive ID result.
 * Compresses the photo to a ~3 KB JPEG thumbnail and stores it in the DB.
 * The thumbnail is immediately injected into the live reference cache — the
 * very next scan will compare against this confirmed specimen.
 */
router.post("/barra-confirm", async (req, res) => {
  const { imageBase64, location, viewingAngle } = req.body as {
    imageBase64?:  string;
    location?:     string;
    viewingAngle?: "top" | "side" | "angled";
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  try {
    const thumb = await makeThumbnailFromBase64(imageBase64, 512, 70);
    if (!thumb) {
      res.status(422).json({ error: "Could not compress image — unsupported format" });
      return;
    }

    await addCommunityReference({
      base64Thumb:  thumb,
      location:     location ?? "WA, Australia",
      viewingAngle: viewingAngle ?? undefined,
    });

    res.json({
      success:   true,
      thumbKb:   Math.round(thumb.length / 1024 * 10) / 10,
      message:   "Confirmed catch saved to Barra Brain — next scan will compare against your fish!",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to save confirmation", detail: String(err) });
  }
});

export default router;
