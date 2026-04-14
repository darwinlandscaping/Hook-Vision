/**
 * Shared image compression utilities.
 * Uses jpeg-js + pngjs — already in package.json.
 *
 * makeThumbnailFromUrl  — fetch a remote image (any format) and compress to JPEG thumb
 * makeThumbnailFromBuf  — compress a Buffer (PNG) to JPEG thumb
 *
 * Called once at startup to pre-compress reference images.
 * Reduces OpenAI vision input from 1–3 MB URLs / base64 → 30–60 KB base64.
 */

/** Nearest-neighbour downscale of raw RGBA pixels */
export function downscaleRGBA(
  src: Uint8Array | Buffer,
  srcW: number,
  srcH: number,
  maxDim: number
): { data: Buffer; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  if (scale >= 1) return { data: Buffer.from(src), width: srcW, height: srcH };
  const dstW = Math.max(1, Math.round(srcW * scale));
  const dstH = Math.max(1, Math.round(srcH * scale));
  const dst  = Buffer.alloc(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(Math.floor(y / scale), srcH - 1);
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(Math.floor(x / scale), srcW - 1);
      const si = (sy * srcW + sx) * 4;
      const di = (y  * dstW + x)  * 4;
      dst[di]     = (src as any)[si];
      dst[di + 1] = (src as any)[si + 1];
      dst[di + 2] = (src as any)[si + 2];
      dst[di + 3] = 255;  // force opaque (JPEG has no alpha)
    }
  }
  return { data: dst, width: dstW, height: dstH };
}

/** Compress a PNG Buffer to a small JPEG base64 thumbnail */
export async function makeThumbnailFromBuf(pngBuf: Buffer, maxDim = 512, quality = 65): Promise<string> {
  const { PNG }    = await import("pngjs") as any;
  const jpegModule = await import("jpeg-js");
  const png        = PNG.sync.read(pngBuf);
  const { data, width, height } = downscaleRGBA(png.data, png.width, png.height, maxDim);
  const encoded = jpegModule.default.encode({ data, width, height }, quality);
  return Buffer.from(encoded.data).toString("base64");
}

/**
 * Fetch a remote image URL and compress to a small JPEG base64 thumbnail.
 * Works for JPEG, PNG, or WebP remote images.
 * Returns null on fetch/parse error so caller can fall back to URL.
 */
export async function makeThumbnailFromUrl(
  url: string,
  maxDim = 512,
  quality = 65,
  timeoutMs = 8_000
): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "HookVision/1.0 (image thumbnail pre-fetch)" },
      signal:  AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) return null;

    const arrayBuf = await resp.arrayBuffer();
    const buf      = Buffer.from(arrayBuf);

    // Detect format from first bytes
    const jpegModule = await import("jpeg-js");

    // Try JPEG decode
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      const decoded = jpegModule.default.decode(buf, { useTArray: true, formatAsRGBA: true });
      const { data, width, height } = downscaleRGBA(decoded.data, decoded.width, decoded.height, maxDim);
      const encoded = jpegModule.default.encode({ data, width, height }, quality);
      return Buffer.from(encoded.data).toString("base64");
    }

    // Try PNG decode
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return makeThumbnailFromBuf(buf, maxDim, quality);
    }

    return null;   // unknown format
  } catch {
    return null;
  }
}

/**
 * Compress a raw base64-encoded image (JPEG or PNG) to a small JPEG thumbnail.
 * Used when storing community-confirmed catches — no URL fetch needed.
 * Returns null on error.
 */
export async function makeThumbnailFromBase64(
  b64: string,
  maxDim = 512,
  quality = 65
): Promise<string | null> {
  try {
    const buf        = Buffer.from(b64, "base64");
    const jpegModule = await import("jpeg-js");

    if (buf[0] === 0xff && buf[1] === 0xd8) {
      // JPEG input
      const decoded = jpegModule.default.decode(buf, { useTArray: true, formatAsRGBA: true });
      const { data, width, height } = downscaleRGBA(decoded.data, decoded.width, decoded.height, maxDim);
      const encoded = jpegModule.default.encode({ data, width, height }, quality);
      return Buffer.from(encoded.data).toString("base64");
    }

    if (buf[0] === 0x89 && buf[1] === 0x50) {
      // PNG input
      return makeThumbnailFromBuf(buf, maxDim, quality);
    }

    return null;
  } catch {
    return null;
  }
}
