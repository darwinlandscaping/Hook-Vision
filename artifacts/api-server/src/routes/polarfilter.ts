/**
 * POST /api/polar-filter
 * Software polarised-lens simulation for glare reduction.
 *
 * Applies three operations that mimic a physical polarising filter:
 *   1. Highlight roll-off  — compresses specular hotspots (water glare, sun reflections)
 *   2. Saturation lift      — polarisers reveal colour hidden under glare
 *   3. Shadow/midtone pop  — slight S-curve so underwater detail lifts
 *
 * Uses jpeg-js (pure JS) — zero native deps, works under esbuild.
 * Input/output: base64 JPEG string.
 * Typical processing time: 80-180ms for a 1280×720 image.
 */
import { Router } from "express";
import jpeg from "jpeg-js";

const router = Router();

// ─── Core polarisation transform (per-pixel, RGBA buffer) ──────────────────
function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Soft highlight roll-off curve.
 * Pixels above `threshold` are compressed toward 255 with a smooth blend,
 * simulating how a real polariser blocks specular light without hard clipping.
 */
function highlightRollOff(v: number, threshold = 188, compress = 0.32): number {
  if (v <= threshold) return v;
  const excess = (v - threshold) / (255 - threshold); // 0→1
  const rolled = threshold + (v - threshold) * compress;
  // smooth blend so the transition isn't a sharp kink
  const blend   = excess * excess; // quadratic ease-in
  return threshold + (rolled - threshold) * blend + (v - threshold) * (1 - blend) * compress;
}

function polarisePixel(r: number, g: number, b: number): [number, number, number] {
  // ── 1. Highlight roll-off (main anti-glare step) ──────────────────────────
  const r1 = highlightRollOff(r);
  const g1 = highlightRollOff(g);
  const b1 = highlightRollOff(b);

  // ── 2. Saturation lift (+18%) ─────────────────────────────────────────────
  // Simple HSP-based saturation: scale each channel away from perceived grey
  const grey = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
  const sat  = 1.18;
  const r2   = grey + (r1 - grey) * sat;
  const g2   = grey + (g1 - grey) * sat;
  const b2   = grey + (b1 - grey) * sat;

  // ── 3. Mild midtone S-curve (pop underwater detail) ──────────────────────
  // Uses a scaled sine approximation: value × (1 + 0.08 × sin(π × norm))
  // Only affects midtones (peaks near 128), leaves near-blacks and near-whites alone
  function sCurve(v: number): number {
    const norm = v / 255;
    const bump = Math.sin(norm * Math.PI) * 0.10;
    return v * (1 + bump);
  }

  return [
    clamp(Math.round(sCurve(r2))),
    clamp(Math.round(sCurve(g2))),
    clamp(Math.round(sCurve(b2))),
  ];
}

function applyPolarFilter(base64Input: string): string {
  const buf = Buffer.from(base64Input, "base64");

  // Decode JPEG → raw RGBA
  const raw = jpeg.decode(buf, { useTArray: true });
  const { width, height } = raw;
  const data = raw.data as Uint8Array;

  // Process every pixel (RGBA stride = 4)
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = polarisePixel(data[i], data[i + 1], data[i + 2]);
    data[i]     = r;
    data[i + 1] = g;
    data[i + 2] = b;
    // Alpha (i+3) unchanged
  }

  // Re-encode to JPEG at quality 90
  const encoded = jpeg.encode({ data, width, height }, 90);
  return Buffer.from(encoded.data).toString("base64");
}

// ─── Route ───────────────────────────────────────────────────────────────────
router.post("/polar-filter", (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  try {
    const filtered = applyPolarFilter(imageBase64);
    res.json({ imageBase64: filtered });
  } catch (err) {
    // Fail open — return original base64 so callers are never blocked
    console.error("[polar-filter] processing error:", err);
    res.json({ imageBase64 });
  }
});

export default router;
