import { useEffect, useState } from "react";

// Karumba, Gulf of Carpentaria — representative NQ Gulf location
const NQ_LAT = -17.488;
const NQ_LON = 140.839;
const NQ_TZ_OFFSET = 10; // UTC+10, Queensland — no daylight saving

/** Convert UTC Date to NQ local time (AEST, no DST) */
function toNQ(utc: Date): Date {
  return new Date(utc.getTime() + NQ_TZ_OFFSET * 3_600_000);
}

/** NQ local decimal hour (e.g. 6.75 = 6:45 AM) from a UTC date */
function nqHour(utc: Date): number {
  const d = toNQ(utc);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/**
 * Compute sunrise and sunset for Gulf Country NQ using the NOAA simplified algorithm.
 * Returns local NQ decimal hours (e.g. { rise: 6.12, set: 18.45 }).
 */
function calcSunTimes(utcDate: Date): { rise: number; set: number } {
  const toRad = Math.PI / 180;
  const nqDate = toNQ(utcDate);

  // Day of year
  const start = new Date(nqDate.getFullYear(), 0, 0);
  const doy   = Math.floor((nqDate.getTime() - start.getTime()) / 86_400_000);

  // Solar declination (degrees)
  const dec = 23.45 * Math.sin(toRad * (360 / 365) * (doy - 81));

  // Cosine of hour angle at sunrise/sunset (accounting for refraction: -0.833°)
  const cosH =
    (-Math.sin(toRad * 0.833) - Math.sin(toRad * NQ_LAT) * Math.sin(toRad * dec)) /
    (Math.cos(toRad * NQ_LAT) * Math.cos(toRad * dec));

  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) * (180 / Math.PI);

  // Equation of Time correction (minutes)
  const B  = toRad * (360 / 365) * (doy - 81);
  const ET = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Time Correction (minutes)
  const TC = 4 * (NQ_LON - 15 * NQ_TZ_OFFSET) + ET;

  // Solar noon in NQ local decimal hours
  const noon = 12 - TC / 60;

  return {
    rise: noon - H / 15,
    set:  noon + H / 15,
  };
}

export interface GoldenHourState {
  isGoldenHour: boolean;
  phase: "morning" | "evening" | null;
  /** 0 → just started, 1 → peak (sunrise/sunset itself), back to 0 at end */
  intensity: number;
  /** NQ local time string e.g. "06:42" */
  sunriseStr: string;
  sunsetStr:  string;
}

function hourToStr(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const DEBUG_FORCE_GOLDEN_HOUR = false; // set true temporarily to preview the effect

function computeState(now: Date): GoldenHourState {
  if (DEBUG_FORCE_GOLDEN_HOUR) {
    return { isGoldenHour: true, phase: "evening", intensity: 0.95, sunriseStr: "06:52", sunsetStr: "18:43" };
  }
  const { rise, set } = calcSunTimes(now);
  const current = nqHour(now);

  const GOLDEN_HOUR = 1.0; // one hour window each side

  const mornStart = rise;
  const mornEnd   = rise + GOLDEN_HOUR;
  const eveStart  = set  - GOLDEN_HOUR;
  const eveEnd    = set;

  let isGoldenHour = false;
  let phase: GoldenHourState["phase"] = null;
  let intensity = 0;

  if (current >= mornStart && current <= mornEnd) {
    isGoldenHour = true;
    phase = "morning";
    // intensity peaks at sunrise (t=0), fades over the hour
    intensity = 1 - (current - mornStart) / GOLDEN_HOUR;
  } else if (current >= eveStart && current <= eveEnd) {
    isGoldenHour = true;
    phase = "evening";
    // intensity builds toward sunset
    intensity = (current - eveStart) / GOLDEN_HOUR;
  }

  return {
    isGoldenHour,
    phase,
    intensity,
    sunriseStr: hourToStr(rise),
    sunsetStr:  hourToStr(set),
  };
}

/**
 * Returns golden-hour state recalculated every minute.
 * isGoldenHour is true for 1 hour after NQ sunrise and 1 hour before NQ sunset.
 * Uses Karumba, Gulf Country as the reference location (AEST UTC+10, no DST).
 */
export function useGoldenHour(): GoldenHourState {
  const [state, setState] = useState<GoldenHourState>(() => computeState(new Date()));

  useEffect(() => {
    // Recalculate immediately then every 60s
    setState(computeState(new Date()));
    const id = setInterval(() => setState(computeState(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  return state;
}
