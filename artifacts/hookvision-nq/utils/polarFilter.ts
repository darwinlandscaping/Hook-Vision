/**
 * polarFilter(base64) → filtered base64
 *
 * Sends an image through the server-side polarised-lens simulation.
 * Reduces water glare, specular hotspots, and highlight blow-out.
 * Fails open — on any error the original base64 is returned unchanged
 * so no scan is ever blocked by a filter failure.
 */

const domain  = process.env.EXPO_PUBLIC_DOMAIN;
const BASE_URL = domain ? `https://${domain}` : "";

export async function polarFilter(imageBase64: string): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/api/polar-filter`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ imageBase64 }),
    });
    if (!res.ok) return imageBase64;
    const data = await res.json() as { imageBase64?: string };
    return data.imageBase64 ?? imageBase64;
  } catch {
    return imageBase64; // network fail → original image passes through
  }
}
