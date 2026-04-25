import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { HVHeader } from "@/components/HVHeader";
import { useColors } from "@/hooks/useColors";
import { useAutoNarrate } from "@/hooks/useAutoNarrate";
import { NarratorButton } from "@/components/NarratorButton";
import { NarratorSettingsTrigger } from "@/components/NarratorSettings";
import {
  WA_TIDE_REGIONS,
  TYPE_LABELS,
  TYPE_COLORS,
  getWAWaterTemp,
  getWASeason,
  type TideLocation,
  type TideRegion,
} from "@/data/ntTideLocations";

// ─── Types ─────────────────────────────────────────────────────────────────────
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
interface TideResponse {
  port: string;
  portKey: string;
  data: TideDay[];
  isSecondary?: boolean;
  refPort?: string;
}

interface DailyWeather {
  tempC: number;
  humidity: number;
  windDir: string;
  windSpeedKmh: number;
  pressureHpa: number;
  pressureTrend: string;
  conditions: string;
}

async function fetchDailyWeather(): Promise<DailyWeather | null> {
  try {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    const res = await fetch(`${baseUrl}/api/daily-conditions`);
    if (!res.ok) return null;
    const d = await res.json();
    return (d.weather as DailyWeather) ?? null;
  } catch {
    return null;
  }
}

// ─── API ───────────────────────────────────────────────────────────────────────
async function fetchTidesForLocation(locationId: string): Promise<TideResponse> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";
  const res = await fetch(`${baseUrl}/api/tides?location=${locationId}&days=3`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error((err as { error: string }).error || "Failed to load tides");
  }
  return res.json();
}

// ─── Moon phase ─────────────────────────────────────────────────────────────────
function getMoonPhase(): { name: string; emoji: string } {
  const knownNew = new Date("2000-01-06T18:14:00Z").getTime();
  const cycle = 29.53058867;
  const days = (Date.now() - knownNew) / 86400000;
  const d = ((days % cycle) + cycle) % cycle;
  if (d < 1.85)  return { name: "New Moon",       emoji: "🌑" };
  if (d < 7.38)  return { name: "Waxing Crescent", emoji: "🌒" };
  if (d < 9.22)  return { name: "First Quarter",   emoji: "🌓" };
  if (d < 14.77) return { name: "Waxing Gibbous",  emoji: "🌔" };
  if (d < 16.61) return { name: "Full Moon",        emoji: "🌕" };
  if (d < 22.15) return { name: "Waning Gibbous",  emoji: "🌖" };
  if (d < 23.99) return { name: "Last Quarter",     emoji: "🌗" };
  return          { name: "Waning Crescent",        emoji: "🌘" };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const tmr = new Date(); tmr.setDate(today.getDate() + 1);
  if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth()) return "Today";
  if (date.getDate() === tmr.getDate() && date.getMonth() === tmr.getMonth()) return "Tomorrow";
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function getTideStage(data: TideDay[]): { label: string; emoji: string; next: TideEntry | undefined } {
  const now = Date.now();
  const all = data.flatMap((d) => d.tides);
  const next = all.find((t) => t.timestamp > now);
  const prev = [...all].reverse().find((t) => t.timestamp <= now);
  if (!next) return { label: "Unknown", emoji: "🌊", next };
  const rising = prev ? next.type === "HW" : next.type === "LW";
  return {
    label: rising ? "Rising" : "Falling",
    emoji: rising ? "📈" : "📉",
    next,
  };
}

// ─── Narrator text builders ──────────────────────────────────────────────────
function buildRegionNarratorText(region: TideRegion): string {
  const stars = region.locations.filter((l) => l.star).map((l) => l.name);
  const intro = `${region.name} has ${region.locations.length} fishing locations. ${stars.length ? `Iconic spots include ${stars.join(" and ")}.` : ""}`;
  const tips = region.locations.slice(0, 5).map((l) => `${l.name}: ${l.tip}`).join(". ");
  return `${intro} ${tips}.`;
}

function buildTideNarratorText(loc: TideLocation, data: TideResponse, weather?: DailyWeather | null): string {
  const season = getWASeason();
  let text = `${loc.name} conditions. ${season.name} — ${season.fishing}. `;
  if (weather) {
    text += `Current conditions: ${weather.windDir} wind at ${weather.windSpeedKmh} kilometres per hour. Humidity ${weather.humidity} percent. Barometer ${weather.pressureHpa} hectopascals and ${weather.pressureTrend}. Air temperature ${weather.tempC} degrees. `;
  }
  text += `Target species: ${loc.species.slice(0, 3).join(", ")}. Best lure: ${loc.lure}. Best time: ${loc.bestTide}. `;
  text += `Fishing tip: ${loc.tip} `;
  for (const day of data.data) {
    text += `${formatDate(day.date)}: `;
    for (const t of day.tides) {
      text += `${t.type === "HW" ? "High" : "Low"} tide at ${t.time}, ${t.height.toFixed(1)} metres. `;
    }
  }
  if (data.isSecondary) {
    const portLabel = data.refPort === "broome" ? "Broome" : data.refPort === "derby" ? "Derby" : data.refPort === "exmouth" ? "Exmouth" : data.refPort === "wyndham" ? "Wyndham" : data.refPort === "dampier" ? "Dampier" : data.refPort === "carnarvon" ? "Carnarvon" : "Port Hedland";
    text += `Times corrected from ${portLabel} BOM. Verify before use.`;
  }
  return text.trim();
}

// ─── Reusable section header ───────────────────────────────────────────────────
function SectionHeader({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Conditions strip ──────────────────────────────────────────────────────────
function ConditionsStrip({
  regionId,
  tideData,
  colors,
}: {
  regionId: string;
  tideData: TideDay[] | undefined;
  colors: ReturnType<typeof useColors>;
}) {
  const moon = getMoonPhase();
  const season = getWASeason();
  const waterTemp = getWAWaterTemp(regionId);
  const tideStage = tideData ? getTideStage(tideData) : null;

  const { data: weather } = useQuery<DailyWeather | null>({
    queryKey: ["daily-weather"],
    queryFn: fetchDailyWeather,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const pills = [
    { emoji: "🌡️", label: "Water Temp", value: waterTemp, color: "#ff7043" },
    { emoji: tideStage?.emoji ?? "🌊", label: "Tide Stage", value: tideStage?.label ?? "—", color: "#00d4aa" },
    { emoji: moon.emoji, label: "Moon", value: moon.name, color: "#7986cb" },
    { emoji: season.emoji, label: "Season", value: season.name, color: "#ffd700" },
    ...(weather ? [
      { emoji: "💨", label: "Wind", value: `${weather.windDir} ${weather.windSpeedKmh}km/h`, color: "#00d4aa" },
      { emoji: "💧", label: "Humidity", value: `${weather.humidity}%`, color: "#00a8ff" },
      { emoji: "📊", label: "Barometer", value: `${weather.pressureHpa}hPa ${weather.pressureTrend === "falling" ? "↓" : weather.pressureTrend === "rising" ? "↑" : "→"}`, color: weather.pressureTrend === "falling" ? "#00d4aa" : weather.pressureTrend === "rising" ? "#ff9800" : "#7986cb" },
      { emoji: "🌡️", label: "Air Temp", value: `${weather.tempC}°C`, color: "#ff9800" },
    ] : []),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.condStrip}>
      {pills.map((p) => (
        <View key={p.label} style={[styles.condPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.condEmoji}>{p.emoji}</Text>
          <Text style={[styles.condLabel, { color: colors.mutedForeground }]}>{p.label}</Text>
          <Text style={[styles.condValue, { color: p.color }]}>{p.value}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Hot spots card ────────────────────────────────────────────────────────────
function HotSpotsCard({ loc, regionColor, colors }: { loc: TideLocation; regionColor: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SectionHeader icon="📍" label="HOT SPOTS" color={regionColor} />
      {loc.hotspots.map((spot, i) => (
        <View key={i} style={styles.hotSpotRow}>
          <View style={[styles.hotSpotDot, { backgroundColor: regionColor }]} />
          <Text style={[styles.hotSpotText, { color: colors.foreground }]}>{spot}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Species + lure card ───────────────────────────────────────────────────────
function SpeciesLureCard({ loc, regionColor, colors }: { loc: TideLocation; regionColor: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SectionHeader icon="🐟" label="TARGET SPECIES" color="#00d4aa" />
      <View style={styles.speciesRow}>
        {loc.species.map((s, i) => (
          <View key={i} style={[styles.speciesBadge, { backgroundColor: "#00d4aa18", borderColor: "#00d4aa44" }]}>
            <Text style={[styles.speciesText, { color: "#00d4aa" }]}>{s}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader icon="🎣" label="BEST LURE / BAIT" color="#ffd700" />
      <Text style={[styles.lureText, { color: colors.foreground }]}>{loc.lure}</Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader icon="⏰" label="BEST TIDE TO FISH" color="#ff7043" />
      <Text style={[styles.lureText, { color: colors.foreground }]}>{loc.bestTide}</Text>
    </View>
  );
}

// ─── Access card ───────────────────────────────────────────────────────────────
function AccessCard({ loc, colors }: { loc: TideLocation; colors: ReturnType<typeof useColors> }) {
  const isRestricted = loc.access.toLowerCase().includes("permit");
  const is4wd = loc.access.toLowerCase().includes("4wd");
  return (
    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SectionHeader icon="🚗" label="ACCESS" color="#4fc3f7" />
      <Text style={[styles.accessText, { color: colors.foreground }]}>{loc.access}</Text>
      <View style={styles.accessBadges}>
        {is4wd && (
          <View style={[styles.accessBadge, { backgroundColor: "#ff8f0018", borderColor: "#ff8f0044" }]}>
            <Text style={[styles.accessBadgeText, { color: "#ff8f00" }]}>4WD Required</Text>
          </View>
        )}
        {isRestricted && (
          <View style={[styles.accessBadge, { backgroundColor: "#e5393518", borderColor: "#e5393544" }]}>
            <Text style={[styles.accessBadgeText, { color: "#e53935" }]}>Permit Required</Text>
          </View>
        )}
        {loc.access.toLowerCase().includes("croc") && (
          <View style={[styles.accessBadge, { backgroundColor: "#ffd70018", borderColor: "#ffd70044" }]}>
            <Text style={[styles.accessBadgeText, { color: "#ffd700" }]}>⚠️ Croc Active</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Tide entry row ────────────────────────────────────────────────────────────
function TideEntryRow({ tide, colors }: { tide: TideEntry; colors: ReturnType<typeof useColors> }) {
  const isHigh = tide.type === "HW";
  const isPast = tide.timestamp < Date.now();
  return (
    <View style={[styles.tideRow, isPast && styles.pastRow]}>
      <View style={[styles.tideTypeTag, { backgroundColor: isHigh ? `${colors.accent}22` : colors.secondary }]}>
        <Feather name={isHigh ? "arrow-up" : "arrow-down"} size={14} color={isHigh ? colors.accent : colors.mutedForeground} />
        <Text style={[styles.tideTypeText, { color: isHigh ? colors.accent : colors.mutedForeground }]}>
          {isHigh ? "HIGH" : "LOW"}
        </Text>
      </View>
      <Text style={[styles.tideTime, { color: isPast ? colors.mutedForeground : colors.foreground }]}>{tide.time}</Text>
      <View style={styles.tideHeightRow}>
        <Text style={[styles.tideHeight, { color: isHigh ? colors.accent : colors.mutedForeground }]}>{tide.height.toFixed(2)}</Text>
        <Text style={[styles.tideUnit, { color: colors.mutedForeground }]}>m</Text>
      </View>
      {isPast && <Text style={[styles.passedLabel, { color: colors.mutedForeground }]}>passed</Text>}
    </View>
  );
}

// ─── Next tide card ────────────────────────────────────────────────────────────
function NextTideCard({ data, colors }: { data: TideDay[]; colors: ReturnType<typeof useColors> }) {
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const all = data.flatMap((d) => d.tides);
  const next = all.find((t) => t.timestamp > now);
  const prev = [...all].reverse().find((t) => t.timestamp <= now);
  if (!next) return null;
  const ms = next.timestamp - now;
  const h = Math.floor(ms / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  const rising = prev ? next.type === "HW" : next.type === "LW";
  return (
    <View style={[styles.nextCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.nextCardHeader}>
        <Feather name={rising ? "trending-up" : "trending-down"} size={18} color={rising ? colors.accent : colors.primary} />
        <Text style={[styles.nextCardTitle, { color: colors.mutedForeground }]}>{rising ? "Tide Rising" : "Tide Falling"}</Text>
      </View>
      <View style={styles.nextCardBody}>
        <View>
          <Text style={[styles.nextTideType, { color: colors.foreground }]}>Next {next.type === "HW" ? "High" : "Low"} Water</Text>
          <Text style={[styles.nextTideTime, { color: colors.primary }]}>{next.time}</Text>
        </View>
        <View style={styles.countdownBox}>
          <Text style={[styles.countdownNum, { color: colors.foreground }]}>{h}h {min}m</Text>
          <Text style={[styles.countdownLabel, { color: colors.mutedForeground }]}>away</Text>
        </View>
      </View>
      <View style={styles.nextHeightRow}>
        <Text style={[styles.nextHeightLabel, { color: colors.mutedForeground }]}>Height</Text>
        <Text style={[styles.nextHeightVal, { color: next.type === "HW" ? colors.accent : colors.primary }]}>{next.height.toFixed(2)}m</Text>
        {prev && (
          <>
            <Text style={[styles.nextHeightLabel, { color: colors.mutedForeground }]}> · Prev</Text>
            <Text style={[styles.nextHeightVal, { color: colors.mutedForeground }]}> {prev.height.toFixed(2)}m</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Location card ─────────────────────────────────────────────────────────────
function LocationCard({ loc, regionColor, onSelect, colors }: {
  loc: TideLocation; regionColor: string; onSelect: () => void; colors: ReturnType<typeof useColors>;
}) {
  const typeColor = TYPE_COLORS[loc.type];
  return (
    <TouchableOpacity
      style={[styles.locCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onSelect} activeOpacity={0.8}
    >
      <View style={[styles.locAccent, { backgroundColor: regionColor }]} />
      <View style={styles.locBody}>
        <View style={styles.locHeader}>
          <Text style={styles.locEmoji}>{loc.emoji}</Text>
          <View style={styles.locTitleCol}>
            <View style={styles.locTitleRow}>
              <Text style={[styles.locName, { color: colors.foreground }]} numberOfLines={1}>{loc.name}</Text>
              {loc.star && <Text style={styles.starBadge}>★</Text>}
            </View>
            <View style={[styles.typeBadge, { backgroundColor: `${typeColor}22` }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{TYPE_LABELS[loc.type]}</Text>
            </View>
          </View>
          <View style={[styles.checkBtn, { backgroundColor: regionColor + "22", borderColor: regionColor + "55" }]}>
            <Feather name="clock" size={13} color={regionColor} />
            <Text style={[styles.checkBtnText, { color: regionColor }]}>Tides</Text>
          </View>
        </View>
        <Text style={[styles.locTip, { color: colors.mutedForeground }]} numberOfLines={2}>{loc.tip}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Tide detail view ──────────────────────────────────────────────────────────
function TideDetailView({ loc, region, onBack, colors, topPad, bottomPad }: {
  loc: TideLocation; region: TideRegion; onBack: () => void;
  colors: ReturnType<typeof useColors>; topPad: number; bottomPad: number;
}) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery<TideResponse>({
    queryKey: ["tides-loc", loc.id],
    queryFn: () => fetchTidesForLocation(loc.id),
    staleTime: 30 * 60 * 1000,
    refetchOnMount: "always",
    retry: 1,
  });

  const { data: weather } = useQuery<DailyWeather | null>({
    queryKey: ["daily-weather"],
    queryFn: fetchDailyWeather,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Back button */}
      <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={onBack} activeOpacity={0.7}>
        <Feather name="arrow-left" size={16} color={colors.foreground} />
        <Text style={[styles.backBtnText, { color: colors.foreground }]}>{region.name}</Text>
      </TouchableOpacity>

      {/* Location header */}
      <View style={[styles.detailHeader, { backgroundColor: colors.card, borderColor: region.color + "55" }]}>
        <View style={[styles.detailAccent, { backgroundColor: region.color }]} />
        <View style={styles.detailHeaderBody}>
          <Text style={styles.detailEmoji}>{loc.emoji}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.detailTitleRow}>
              <Text style={[styles.detailName, { color: colors.foreground }]}>{loc.name}</Text>
              {loc.star && <Text style={styles.detailStar}>★</Text>}
            </View>
            <View style={[styles.typeBadge, { backgroundColor: `${TYPE_COLORS[loc.type]}22` }]}>
              <Text style={[styles.typeBadgeText, { color: TYPE_COLORS[loc.type] }]}>{TYPE_LABELS[loc.type]}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.detailTipBox, { backgroundColor: colors.background }]}>
          <Text style={[styles.detailTipLabel, { color: region.color }]}>🎣 FISHING TIP</Text>
          <Text style={[styles.detailTip, { color: colors.foreground }]}>{loc.tip}</Text>
        </View>
      </View>

      {/* Conditions strip — always visible */}
      <ConditionsStrip regionId={region.id} tideData={data?.data} colors={colors} />

      {/* Hot spots */}
      <HotSpotsCard loc={loc} regionColor={region.color} colors={colors} />

      {/* Species + lure + best tide */}
      <SpeciesLureCard loc={loc} regionColor={region.color} colors={colors} />

      {/* Access */}
      <AccessCard loc={loc} colors={colors} />

      {/* Tide loading / error */}
      {isLoading && (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching tide predictions...</Text>
        </View>
      )}

      {error && (
        <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}44` }]}>
          <Feather name="alert-circle" size={16} color={colors.destructive} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error instanceof Error ? error.message : "Could not load tides"}
            </Text>
            <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 6 }}>
              <Text style={[styles.retryText, { color: colors.primary }]}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tides section header */}
      {data && (
        <>
          <View style={styles.tidesHeaderRow}>
            <SectionHeader icon="🌊" label="TIDE PREDICTIONS" color={colors.primary} />
            <Text style={[styles.tidesSubtitle, { color: colors.mutedForeground }]}>Broome time (UTC+8:00)</Text>
          </View>

          {data.data.length > 0 && <NextTideCard data={data.data} colors={colors} />}

          {data.data.map((day) => (
            <View key={day.date}>
              <Text style={[styles.dayHeader, { color: colors.mutedForeground }]}>{formatDate(day.date)}</Text>
              <View style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {day.tides.length === 0 ? (
                  <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>No data for this day</Text>
                ) : (
                  day.tides.map((tide, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <View style={[styles.tideDivider, { backgroundColor: colors.border }]} />}
                      <TideEntryRow tide={tide} colors={colors} />
                    </React.Fragment>
                  ))
                )}
              </View>
            </View>
          ))}

          <NarratorButton pageType="tide predictions" content={buildTideNarratorText(loc, data, weather)} />

          <View style={[styles.disclaimer, { backgroundColor: colors.secondary }]}>
            <Feather name="info" size={12} color={colors.mutedForeground} />
            <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
              {data.isSecondary
                ? `Corrected from ${data.refPort === "broome" ? "Broome" : data.refPort === "derby" ? "Derby" : data.refPort === "exmouth" ? "Exmouth" : data.refPort === "wyndham" ? "Wyndham" : data.refPort === "dampier" ? "Dampier" : data.refPort === "carnarvon" ? "Carnarvon" : "Port Hedland"} BOM using standard secondary port corrections. Verify before use.`
                : "Sourced from Bureau of Meteorology. Always check current conditions before heading out."}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function TidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedRegionId, setSelectedRegionId] = useState("broome");
  const [selectedLoc, setSelectedLoc] = useState<TideLocation | null>(null);

  useAutoNarrate(() => "WA Tides. Fishing locations across Kimberley, Pilbara, and Exmouth rivers, boat ramps, river mouths and rock bars. Select a region to get water temp, hot spots, target species, best lures, access info and tide predictions.");

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 70 : insets.bottom + 24;
  const selectedRegion = WA_TIDE_REGIONS.find((r) => r.id === selectedRegionId) ?? WA_TIDE_REGIONS[0];

  if (selectedLoc) {
    return (
      <TideDetailView
        loc={selectedLoc}
        region={selectedRegion}
        onBack={() => setSelectedLoc(null)}
        colors={colors}
        topPad={topPad}
        bottomPad={bottomPad}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: topPad + 12, paddingHorizontal: 14, gap: 10, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <HVHeader subtitle="WA Tide Predictions" />
          <NarratorSettingsTrigger />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionTabRow}>
          {WA_TIDE_REGIONS.map((r) => {
            const active = r.id === selectedRegionId;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.regionTab, { backgroundColor: active ? r.color : colors.card, borderColor: active ? r.color : colors.border }]}
                onPress={() => { setSelectedRegionId(r.id); setSelectedLoc(null); }}
                activeOpacity={0.75}
              >
                <Text style={styles.regionTabEmoji}>{r.emoji}</Text>
                <Text style={[styles.regionTabText, { color: active ? "#0a1628" : colors.mutedForeground }]}>{r.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.regionInfoRow}>
          <View style={styles.regionInfo}>
            <View style={[styles.regionDot, { backgroundColor: selectedRegion.color }]} />
            <Text style={[styles.regionInfoText, { color: colors.mutedForeground }]}>
              {selectedRegion.locations.length} locations · {selectedRegion.refNote}
            </Text>
          </View>
          <NarratorButton compact pageType="tide region" content={buildRegionNarratorText(selectedRegion)} />
        </View>

        <ConditionsStrip regionId={selectedRegion.id} tideData={undefined} colors={colors} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.locList, { paddingBottom: bottomPad }]}>
        {selectedRegion.locations.map((loc) => (
          <LocationCard key={loc.id} loc={loc} regionColor={selectedRegion.color} onSelect={() => setSelectedLoc(loc)} colors={colors} />
        ))}
        <View style={[styles.disclaimer, { backgroundColor: colors.secondary, marginTop: 4 }]}>
          <Feather name="info" size={12} color={colors.mutedForeground} />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            ★ marks iconic Kimberley and WA fishing locations. Tide times are in AWST (UTC+8:00). Secondary locations use BOM secondary port correction tables.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 14, gap: 10 },

  regionTabRow: { gap: 6, paddingBottom: 2 },
  regionTab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  regionTabEmoji: { fontSize: 14 },
  regionTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  regionInfoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  regionInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  regionDot: { width: 6, height: 6, borderRadius: 3 },
  regionInfoText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  locList: { paddingHorizontal: 14, gap: 8, paddingTop: 4 },
  locCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", flexDirection: "row" },
  locAccent: { width: 4 },
  locBody: { flex: 1, padding: 12, gap: 6 },
  locHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  locEmoji: { fontSize: 22 },
  locTitleCol: { flex: 1, gap: 4 },
  locTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locName: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  starBadge: { fontSize: 14, color: "#ffd700" },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  checkBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  checkBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  locTip: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  backBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  detailHeader: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  detailAccent: { height: 4 },
  detailHeaderBody: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingBottom: 8 },
  detailEmoji: { fontSize: 28 },
  detailTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailName: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  detailStar: { fontSize: 16, color: "#ffd700" },
  detailTipBox: { margin: 12, marginTop: 4, padding: 10, borderRadius: 10, gap: 4 },
  detailTipLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  detailTip: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  // Conditions
  condStrip: { gap: 8, paddingRight: 4 },
  condPill: { alignItems: "center", gap: 3, padding: 10, borderRadius: 12, borderWidth: 1, minWidth: 90 },
  condEmoji: { fontSize: 20 },
  condLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.6 },
  condValue: { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },

  // Info cards
  infoCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionIcon: { fontSize: 14 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.9, textTransform: "uppercase" },
  divider: { height: 1 },

  hotSpotRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  hotSpotDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  hotSpotText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  speciesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  speciesBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  speciesText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  lureText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  accessText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  accessBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  accessBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  accessBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Tides
  tidesHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tidesSubtitle: { fontSize: 10, fontFamily: "Inter_400Regular" },
  loadingState: { alignItems: "center", gap: 12, paddingVertical: 40 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  nextCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  nextCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  nextCardTitle: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.8 },
  nextCardBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  nextTideType: { fontSize: 12, fontFamily: "Inter_500Medium" },
  nextTideTime: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  countdownBox: { alignItems: "flex-end" },
  countdownNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  countdownLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  nextHeightRow: { flexDirection: "row", alignItems: "center" },
  nextHeightLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  nextHeightVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginLeft: 4 },
  dayHeader: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: -4 },
  dayCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  tideRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  pastRow: { opacity: 0.45 },
  tideTypeTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, width: 70 },
  tideTypeText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tideTime: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  tideHeightRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  tideHeight: { fontSize: 15, fontFamily: "Inter_700Bold" },
  tideUnit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  passedLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  tideDivider: { height: 1, marginHorizontal: 14 },
  noDataText: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 16, textAlign: "center" },

  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10 },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
