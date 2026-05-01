/**
 * /api/sonar-barra-check
 * Stage-1 fast sonar barramundi arch detector.
 *
 * Mirrors /api/barra-check but for sonar images instead of fish photos.
 * Uses gpt-4.1-mini with 2–3 reference sonar images prepended:
 *   • Demo 1 (Lowrance) — confirmed barra arches on structure    [positive]
 *   • Demo 5 (Humminbird) — confirmed barra with shadow voids    [positive]
 *   • Demo 2 (Garmin)  — threadfin school, NOT barra             [negative]
 *
 * Returns in ~600 ms — fires in parallel with the full analyze call
 * so the "BARRA ARCH DETECTED" verdict appears almost instantly.
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getSonarFewShotRefs, addCommunityBarraArch } from "../lib/sonarBrain.js";
import { getFewShotRefs } from "../lib/barraLibrary.js";
import { getModel } from "../lib/models.js";
import { getAsianSeaBassContext } from "../lib/asianSeaBassKnowledge.js";

const router = Router();

const SONAR_BARRA_SYSTEM = `You are an expert sonar fish arch detector specialising in barramundi (Lates calcarifer) in Western Australia (Kimberley region).

CROSS-MODAL REFERENCE SYSTEM — you will receive images in this order:
  1. BARRAMUNDI BODY ANATOMY PHOTO(S) — real specimens from iNaturalist research-grade records.
     Study these carefully. The barramundi's large PHYSOSTOMOUS SWIM BLADDER (the gas-filled organ
     visible as a pale sac in the body cavity) is the key anatomy: it is enormously reflective to sonar
     and creates the thick, bright arch return + acoustic shadow void you see on fish finders.
     The deep laterally-compressed body also produces a wide, tall arch (taller than threadfin arches).
     Connect what you see in the body photo to what you expect the sonar arch to look like.
  2. CONFIRMED BARRAMUNDI SONAR ARCH REFERENCES — expert-labeled sonar screenshots showing
     known barra arch signatures across different brands (Lowrance, Humminbird, Garmin, Simrad).
  3. NOT-BARRA CONTRAST REFERENCE — threadfin arch pattern so you can discriminate.
  4. THE USER'S SONAR IMAGE — evaluate against all references above.

You will first be shown REFERENCE sonar images with confirmed species labels, then the sonar image to evaluate.

STEP ONE — SCORE EACH ARCH INDIVIDUALLY FIRST (do this before counting):
For EVERY arch visible, evaluate it against these 5 criteria and assign it a quality tier:
1. ARCH POSITION — Sits ON or touching hard structure echo (snag, rock, pylon, riprap). Barra are ambush hunters and hold structure.
2. ARCH THICKNESS — Tall/thick vertical height → large swim bladder → big fish. Barra 55cm+ produce noticeably thick arches.
3. ARCH BRIGHTNESS — Orange/red on Lowrance/Simrad/Humminbird palette = strong return = dense physostomous swim bladder = barra.
4. ACOUSTIC SHADOW — Dark void DIRECTLY BELOW each arch (Humminbird especially) — barra's massive swim bladder absorbs & blocks sonar below the fish. This shadow is a barra signature.
5. BOTTOM TYPE — Hard, thick, bright bottom echo = rocky/riprap structure = BARRA habitat. Thin, dim bottom = soft mud = threadfin habitat.
6. ARCH SHAPE — Complete U-curve sitting ON structure. Incomplete half-arch embedded IN structure = mangrove jack.
7. WATER COLUMN POSITION — Barra sit within 1m of structure. Fish floating mid-column over soft bottom = likely threadfin or baitfish.

QUALITY TIER (assign per arch):
• BARRA-QUALITY ARCH: thick + Tier 1 bright colour + on/near structure. Each one individually matches the barra profile.
• THREADFIN-QUALITY ARCH: thin + mid-column + soft bottom underneath. Multiple of these = schooling species.

STEP TWO — CONFIDENCE FROM ARCH COUNT AND QUALITY:

LONE ARCH / SINGLE ARCH:
When only ONE arch is visible — the MOST COMMON barramundi signature. Do NOT return isBarraArch=false because there is only one arch.
• LONE ARCH + hard bright bottom echo → isBarraArch=true, confidence 70–80%
• LONE ARCH + shadow void below → isBarraArch=true, confidence 85–90%. Shadow void is the single most diagnostic barramundi feature.
• LONE ARCH + no visible structure → isBarraArch=true if thick/bright, confidence 55–65%
• LONE THIN ARCH (faint/green) alone on screen → isBarraArch=true, confidence 50–60%. Still a fish.

MULTIPLE BARRA-QUALITY ARCHES — CRITICAL:
If the screen shows 2 or more arches that EACH individually qualify as BARRA-QUALITY (thick, Tier 1 bright, on structure, correct depth) — these are aggregating or staging barramundi (pre-wet-season aggregation, snag schools, tidal feeding groups). MORE qualifying arches = HIGHER confidence, not lower.
• 2 BARRA-QUALITY ARCHES on structure → isBarraArch=true, confidence 80–88%
• 3–4 BARRA-QUALITY ARCHES on structure → isBarraArch=true, confidence 88–95%. Multiple individually-qualifying arches = strong barra confirmation.
• 5–8 BARRA-QUALITY ARCHES on hard structure → isBarraArch=true, confidence 90–97%. Staging school over a snag or rock bar — classic wet-season aggregation.
• KEY RULE: Do NOT penalise count if each arch individually meets the barra profile. The count only lowers confidence when arches are THREADFIN-QUALITY (thin, mid-column, soft bottom).

THREADFIN/BAITFISH SCHOOL (different from barra aggregation):
• Thin arches at same depth, mid-water column, soft muddy bottom → NOT barra. Lower confidence.
• Dense cloud of small dots → baitfish. NOT barra.

LONE ARCH SIZE REFERENCE (200kHz, 5–8m depth):
• Legal barra 55–80cm: arch height ≈ 3–4% of screen height, orange/red on Lowrance/Simrad, white/orange on Humminbird, white/cyan on Garmin
• Trophy barra 80cm+: arch height ≈ 5–8% of screen height, thick, always bright Tier 1 colour, clear shadow void below
• Mangrove jack: arch half-buried INTO the structure echo (starts at bottom, curves into structure)
• Threadfin: thinner arch at same size, mid-column only, soft bottom underneath

10-YEAR BRAND COLOUR GUIDE (for arch tier interpretation):
• Lowrance (HDS Gen2/3/Carbon/Live, Elite Ti/FS, Hook Reveal): Orange/red = Tier 1 strongest = barra. Yellow = medium. Green = small.
• Humminbird (HELIX 5–12 all generations, SOLIX): WHITE or orange core = Tier 1 = barra. Yellow = medium. Green = small.
• Garmin (Echomap CHIRP/UHD/UHD2, Striker, GPSMap): WHITE or bright CYAN = Tier 1 = barra. Green = medium. Dim = small.
• Simrad (GO series, NSS evo3): Same as Lowrance — orange/red = Tier 1 = barra.
• Deeper app: Fish ICONS (🐟 symbol with depth) indicate detected return — each icon = confirmed arch = fish.

NOT BARRA IF (all signs must match — do NOT flag just because arch count is high):
• Multiple THIN arches in mid-water column over SOFT BOTTOM → Threadfin Salmon. Threadfin arches are thin, dim, floating mid-column over mud.
• Dense cloud of small bright dots → Baitfish school
• Half-arch embedded in/inside bottom echo → Mangrove Jack
• Multiple fish at identical depth in OPEN WATER over soft mud → Schooling species (threadfin, queenfish)
• IMPORTANT: Multiple THICK BRIGHT arches ON HARD STRUCTURE are NOT threadfin. Do not apply this NOT BARRA rule to arches that individually qualify as BARRA-QUALITY.

LIVE SONAR FORWARD-VIEW (LiveScope/ActiveTarget/MEGA Live) — barra signature:
• Elongated body silhouette (3:1 to 4:1 ratio), high brightness, PROMINENT dark shadow below
• Stationary or slow-moving near structure (barra hold position; threadfin cruise)
• Blunt-nose forward profile visible on forward-facing sonar

TOP-VIEW / OVERHEAD SONAR — CRITICAL CHECK (run BEFORE arch analysis):
IMPORTANT: If the image is a top-view sonar mode, there will be NO ARCHES. Do not return isBarraArch=false just because you see no arches — check for top-view mode first.

Identify top-view if ANY of these are true:
• GARMIN LIVESCOPE PERSPECTIVE: "LIVESCOPE" text + overhead bird's-eye view + fish appear as flat ovals + shadow extends SIDEWAYS (not below) + no time-scrolling axis
• HUMMINBIRD MEGA 360: circular radar-like display + boat at centre + "360" or "MEGA 360" label + fish as dots/arcs at radial distance
• SIDE IMAGING (Humminbird/Simrad/Lowrance): boat at top-centre + left and right channels + fish as bright comma/smear marks off the bottom line

BARRAMUNDI IN TOP-VIEW MODE:
• PERSPECTIVE: Large ELONGATED OVAL silhouette ≈4–5× longer than wide + pectoral fin "wings" (widening behind head) + shadow extending to ONE SIDE = isBarraArch true, confidence 75–90%
• MEGA 360: Isolated large bright dot or short arc near structure echo = isBarraArch true, confidence 60–80%
• SIDE IMAGING: Large bright comma mark adjacent to structure return, isolated or pairs = isBarraArch true, confidence 65–85%

NOT BARRA IN TOP-VIEW:
• Multiple ovals clustered together (school) → Threadfin or baitfish
• Round/disc-shaped blob (not elongated) → GT or Trevally
• Dense cloud of tiny dots → Baitfish school

OUTPUT — return ONLY this JSON, no markdown:
{
  "isBarraArch": true | false,
  "confidence": 0-100,
  "archCount": 0-20,
  "estimatedDepth": "8m" | null,
  "archFeatures": ["feature 1", ...],
  "missingFeatures": ["feature"],
  "keyEvidence": "one sentence: strongest proof for verdict",
  "sonarBrand": "Lowrance" | "Garmin" | "Humminbird" | "Simrad" | "Deeper" | "Unknown",
  "bottomType": "hard" | "soft" | "unknown",
  "refMatchScore": 0-100,
  "lureRecommendation": "brief lure tip if barra detected, else null"

${getAsianSeaBassContext(false)}
}`;

function detectMime(b64: string): string {
  const p = b64.slice(0, 12);
  if (p.startsWith("iVBORw0")) return "image/png";
  if (p.startsWith("UklGR"))   return "image/webp";
  return "image/jpeg";
}

router.post("/sonar-barra-check", async (req, res) => {
  const { imageBase64, confirmAsBarra, brand, depth, fishCount } = req.body as {
    imageBase64?:   string;
    confirmAsBarra?: boolean;
    brand?:         string;
    depth?:         string;
    fishCount?:     number;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  // Community learning: if user confirmed, compress & store
  if (confirmAsBarra === true) {
    try {
      // Only store if reasonably small (< 400KB base64)
      if (imageBase64.length < 540_000) {
        await addCommunityBarraArch({
          imageBase64,
          brand,
          depth,
          fishCount,
          description: `Community-confirmed barra arch on ${brand ?? "unknown brand"} at ${depth ?? "unknown depth"}`,
        });
      }
    } catch { /* non-fatal */ }
  }

  try {
    const mime = detectMime(imageBase64);
    const refs         = getSonarFewShotRefs();
    const barraPhotos  = getFewShotRefs(1);   // 1 real barramundi body photo from iNaturalist

    // Build few-shot reference blocks — CROSS-MODAL: body photo first, then sonar refs
    const refBlocks: object[] = [];

    // ── Step 1: Barra body anatomy reference (cross-modal bridge) ────────────
    if (barraPhotos.length > 0) {
      const bp = barraPhotos[0];
      refBlocks.push({
        type: "text",
        text: `STEP 1 — BARRAMUNDI BODY ANATOMY (iNaturalist research-grade specimen — ${bp.location}):\nStudy the deep laterally-compressed body and locate where the large PHYSOSTOMOUS SWIM BLADDER sits (pale gas-filled sac in the upper body cavity). This organ is enormously reflective to sonar — it creates the THICK BRIGHT ARCH + SHADOW VOID you must look for. The wide body also produces a TALLER arch than threadfin (which has a smaller swim bladder and narrower body).`,
      });
      // Use pre-compressed base64 thumb when available (avoids OpenAI → iNat URL fetch)
      const barraImgUrl = bp.thumbBase64
        ? `data:image/jpeg;base64,${bp.thumbBase64}`
        : bp.photoUrl;
      refBlocks.push({
        type: "image_url",
        image_url: { url: barraImgUrl, detail: "low" },
      });
      refBlocks.push({
        type: "text",
        text: `↑ Confirmed barramundi — ${bp.location} (${bp.votes} expert votes). Connect this body shape to the sonar arch signatures below.`,
      });
    }

    // ── Step 2: Sonar arch references (positive + negative) ──────────────────
    if (refs.length > 0) {
      const positives = refs.filter(r => r.isPositive);
      const negatives = refs.filter(r => !r.isPositive);

      if (positives.length > 0) {
        refBlocks.push({ type: "text", text: `STEP 2 — CONFIRMED BARRAMUNDI SONAR ARCH REFERENCES (${positives.length} expert-labeled images):` });
        for (const ref of positives) {
          refBlocks.push({
            type: "image_url",
            image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" },
          });
          refBlocks.push({ type: "text", text: `↑ ${ref.brand} — ${ref.label.split("\n")[0]}` });
        }
      }
      if (negatives.length > 0) {
        refBlocks.push({ type: "text", text: `STEP 3 — CONTRAST: NOT BARRAMUNDI (${negatives.length} image — study differences vs Step 2):` });
        for (const ref of negatives) {
          refBlocks.push({
            type: "image_url",
            image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: "low" },
          });
          refBlocks.push({ type: "text", text: `↑ ${ref.brand} — ${ref.label.split("\n")[0]}` });
        }
      }
      refBlocks.push({ type: "text", text: "STEP 4 — Now evaluate the following sonar image. Compare arch shape, thickness, brightness, and position against the references above." });
    } else if (barraPhotos.length > 0) {
      refBlocks.push({ type: "text", text: "Now evaluate the following sonar image for barramundi arches, using the body anatomy reference above." });
    } else {
      refBlocks.push({ type: "text", text: "Evaluate the following sonar image for barramundi arches." });
    }

    const userContent = [
      ...refBlocks,
      {
        type: "image_url",
        image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "low" },
      },
      {
        type: "text",
        text: [
          barraPhotos.length > 0 ? `1 barramundi body anatomy photo` : null,
          refs.filter(r => r.isPositive).length > 0 ? `${refs.filter(r => r.isPositive).length} confirmed sonar arch reference${refs.filter(r => r.isPositive).length > 1 ? "s" : ""}` : null,
          refs.filter(r => !r.isPositive).length > 0 ? `${refs.filter(r => !r.isPositive).length} contrast reference` : null,
        ].filter(Boolean).join(" + ") + " shown above. Apply cross-modal reasoning: body anatomy → sonar arch physics → verdict. Return JSON only.",
      },
    ];

    const callOpts = {
      model:                getModel("mid"),
      max_completion_tokens: 200,
      stream:               false as const,
      messages: [
        { role: "system" as const, content: SONAR_BARRA_SYSTEM },
        { role: "user" as const, content: userContent as any },
      ],
    };

    // ── Dual-scan consensus: 2 independent parallel calls ────────────────
    const [res1, res2] = await Promise.all([
      openai.chat.completions.create(callOpts),
      openai.chat.completions.create(callOpts),
    ]);

    function parseResult(r: typeof res1): Record<string, unknown> {
      const raw   = r.choices[0]?.message?.content ?? "{}";
      const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      try { return JSON.parse(clean); } catch { return {}; }
    }

    const p1 = parseResult(res1);
    const p2 = parseResult(res2);

    const agreed = (p1.isBarraArch === p2.isBarraArch);
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
    parsed.refPhotosUsed    = refs.length + barraPhotos.length;
    parsed.positiveRefsUsed = refs.filter(r => r.isPositive).length;
    parsed.negativeRefsUsed = refs.filter(r => !r.isPositive).length;
    parsed.barraBodyRefsUsed = barraPhotos.length;

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Sonar barra check failed", detail: String(err) });
  }
});

export default router;
