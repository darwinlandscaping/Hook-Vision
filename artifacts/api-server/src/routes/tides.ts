import { Router } from "express";

const router = Router();

interface TideEntry {
  time: string;
  type: "HW" | "LW";
  height: number;
  timestamp: number;
}

interface TideDay {
  date: string;
  tides: TideEntry[];
}

interface CacheEntry {
  data: TideDay[];
  fetchedAt: number;
}

const NT_PORTS: Record<string, { code: string; name: string; tz: string }> = {
  darwin: { code: "NT_TP001", name: "Darwin", tz: "Australia/Darwin" },
  gove: { code: "NT_TP002", name: "Gove (Nhulunbuy)", tz: "Australia/Darwin" },
  groote: { code: "NT_TP003", name: "Groote Eylandt", tz: "Australia/Darwin" },
};

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function parseBomHtml(html: string): TideDay[] {
  const result: Map<string, TideDay> = new Map();

  // BOM HTML actual format (discovered from inspection):
  // <table ... summary="Times and Heights of High (H) and Low (L) waters for Darwin, 10 April 2026">
  //   <td data-time-utc="2026-04-09T19:10:00Z" data-time-local="2026-04-10T04:40:00+09:30" class="localtime low-tide">4:40 am</td>
  //   <td class="height low-tide">2.76 m</td>
  //   <td data-time-utc="2026-04-10T01:37:00Z" data-time-local="2026-04-10T11:07:00+09:30" class="localtime high-tide">11:07 am</td>
  //   <td class="height high-tide">5.58 m</td>
  // </table>

  // Step 1: extract date from summary attributes
  const summaryRe = /summary="[^"]*?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})"/gi;
  const MONTHS: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  };

  const tablePositions: Array<{ pos: number; date: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = summaryRe.exec(html)) !== null) {
    const day = m[1].padStart(2, "0");
    const month = MONTHS[m[2].toLowerCase()];
    const year = m[3];
    const dateStr = `${year}-${month}-${day}`;
    tablePositions.push({ pos: m.index, date: dateStr });
    if (!result.has(dateStr)) {
      result.set(dateStr, { date: dateStr, tides: [] });
    }
  }

  // Step 2: extract all tide entries.
  // BOM HTML format (actual):
  // <td data-time-utc="2026-04-09T19:10:00Z" data-time-local="2026-04-10T04:40:00+09:30" class="localtime low-tide">4:40 am</td>
  // <td class="height low-tide">2.76 m</td>
  // Both data-time-utc and data-time-local are on the same <td> element.
  const tideRe =
    /data-time-utc="([^"]+)"\s+data-time-local="(\d{4}-\d{2}-\d{2})[^"]*"\s+class="localtime\s+(low|high)-tide">([^<]+)<\/td>[\s\S]*?<td[^>]+class="height[^"]*">([\d.]+)\s*m/gi;

  while ((m = tideRe.exec(html)) !== null) {
    const utcIso = m[1];
    const localDate = m[2]; // "2026-04-10"
    const tideTypeWord = m[3]; // "low" or "high"
    const localTimeText = m[4].trim(); // e.g. "4:40 am"
    const height = parseFloat(m[5]);
    const timestamp = new Date(utcIso).getTime();
    const type: "HW" | "LW" = tideTypeWord === "high" ? "HW" : "LW";

    // Format time: "4:40 am" → "4:40 AM"
    const [timePart, ampm] = localTimeText.split(" ");
    const displayTime = `${timePart} ${(ampm || "").toUpperCase()}`;

    if (!result.has(localDate)) {
      result.set(localDate, { date: localDate, tides: [] });
    }
    result.get(localDate)!.tides.push({ time: displayTime, type, height, timestamp });
  }

  // Sort each day's tides by timestamp
  for (const day of result.values()) {
    day.tides.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Return sorted by date
  return Array.from(result.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchBomTides(
  portCode: string,
  dateStr: string,
  days: number,
  tz: string
): Promise<TideDay[]> {
  const url = new URL("https://www.bom.gov.au/australia/tides/print.php");
  url.searchParams.set("aac", portCode);
  url.searchParams.set("type", "tide");
  url.searchParams.set("date", dateStr);
  url.searchParams.set("region", "NT");
  url.searchParams.set("tz", tz);
  url.searchParams.set("days", String(days));

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-AU,en;q=0.9",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`BOM returned HTTP ${res.status}`);
  }

  const html = await res.text();
  const parsed = parseBomHtml(html);

  if (parsed.length === 0 || parsed.every((d) => d.tides.length === 0)) {
    throw new Error("Tide data unavailable from BOM. Try again later.");
  }

  return parsed;
}

router.get("/tides", async (req, res) => {
  const portKey = ((req.query["port"] as string) || "darwin").toLowerCase();
  const days = Math.min(parseInt((req.query["days"] as string) || "3", 10), 5);

  const port = NT_PORTS[portKey];
  if (!port) {
    res.status(400).json({
      error: `Unknown port. Available: ${Object.keys(NT_PORTS).join(", ")}`,
    });
    return;
  }

  const cacheKey = `${portKey}-${days}`;
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].fetchedAt < CACHE_TTL) {
    res.json({ port: port.name, portKey, data: cache[cacheKey].data });
    return;
  }

  // Get today's date in Darwin timezone
  const darwinDate = new Date().toLocaleDateString("en-CA", {
    timeZone: port.tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  try {
    const data = await fetchBomTides(port.code, darwinDate, days, port.tz);
    cache[cacheKey] = { data, fetchedAt: now };
    res.json({ port: port.name, portKey, data });
  } catch (err) {
    req.log.error({ err }, "BOM tides fetch failed");
    res.status(502).json({
      error:
        err instanceof Error
          ? err.message
          : "Could not fetch tide data from Bureau of Meteorology.",
    });
  }
});

router.get("/tides/ports", (_req, res) => {
  res.json(
    Object.entries(NT_PORTS).map(([key, val]) => ({ key, name: val.name }))
  );
});

export default router;
