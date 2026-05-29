import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const BASE_URL =
  Platform.OS === "web"
    ? typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}`
      : ""
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "";

const HUD_DATA_URL = `${BASE_URL}/api/hud/data`;
const POLL_MS      = 6000;
const PANEL_SECS   = 20;
const PANEL_COUNT  = 8;

const PANEL_NAMES   = ["Sonar Scan","Barra Profile","Environment","Birds & Bait","Croc & Safety","Water","Community","AI Target"];
const PANEL_COLORS  = ["#00d4aa","#ffd700","#00a8ff","#00e5ff","#ff3b30","#00a8ff","#00e5ff","#ffd700"];

interface HudData {
  species: string; fishCount: number; depth: string; confidence: number;
  suggestion: string; archCount?: number; archShape?: string | null;
  sonarMode?: string | null; waterTemp?: string; bottomType?: string; lure?: string;
  crocAlert?: boolean; crocWarning?: string | null; birdAlert?: string | null;
  birdActivity?: string | null; barraPct?: number | null; baitSchool?: boolean | null;
  waterClarity?: string | null; region?: string; source?: string; updatedAt: number;
}
interface BrainTarget {
  targetSpecies: string; targetDepth: string; targetLure: string;
  targetTechnique: string; castZone: string; confidence: number;
  urgency: "NOW"|"SOON"|"LATER"; reasoning: string; tideNote: string;
  seasonNote: string; communityNote: string; compiledAt: number;
}
interface TideContext {
  port: string; state: string; phase: string;
  nextTide?: { type: string; time: string; height: number } | null;
}
interface CommunityContext {
  hotSpecies: { species: string; count: number; trend: string }[];
  tips: string[]; summary: string; reportCount: number;
}
interface EnvContext { season: string; timeOfDay: string; moonPhase: string; }
interface HudState {
  scan?: HudData | null; brain?: BrainTarget | null; tide?: TideContext | null;
  community?: CommunityContext | null; env?: EnvContext;
  updatedAt: number; brainUpdatedAt: number;
}

const C = {
  navy: "#050d1c", teal: "#00d4aa", blue: "#00a8ff", gold: "#ffd700",
  red: "#ff3b30", amber: "#ffb300", cyan: "#00e5ff", green: "#34c759",
  dim: "rgba(255,255,255,0.45)", dimmer: "rgba(255,255,255,0.25)",
};

function ConfBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <View style={styles.confRow}>
      <View style={styles.confTrack}>
        <View style={[styles.confFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.confPct, { color }]}>{pct}%</Text>
    </View>
  );
}

function MetricBox({ label, value, color, accent }: { label: string; value: string; color?: string; accent?: string }) {
  return (
    <View style={[styles.metricBox, accent ? { borderColor: accent + "33", backgroundColor: accent + "0a" } : {}]}>
      <Text style={[styles.metricVal, color ? { color } : {}]} numberOfLines={1} adjustsFontSizeToFit>{value || "—"}</Text>
      <Text style={styles.metricLbl}>{label}</Text>
    </View>
  );
}

function InfoBlock({ text, borderColor, bgColor }: { text: string; borderColor: string; bgColor?: string }) {
  if (!text) return null;
  return (
    <View style={[styles.infoBlock, { borderLeftColor: borderColor, backgroundColor: bgColor ?? borderColor + "0a" }]}>
      <Text style={styles.infoBlockText}>{text}</Text>
    </View>
  );
}

function UrgencyTag({ urgency }: { urgency: string }) {
  const col = urgency === "NOW" ? C.green : urgency === "SOON" ? C.amber : C.dim;
  return (
    <View style={[styles.urgTag, { borderColor: col }]}>
      <Text style={[styles.urgTagText, { color: col }]}>{urgency}</Text>
    </View>
  );
}

// ── Panels ────────────────────────────────────────────────────────────────────

function PanelSonar({ s }: { s: HudData | null | undefined }) {
  if (!s) return <WaitingContent sub="Run a sonar scan to see data here." />;
  const pct = Math.round((s.confidence || 0) * 100);
  return (
    <View style={styles.panelBody}>
      <Text style={[styles.heroSpecies, { color: C.teal }]} numberOfLines={2}>{s.species || "—"}</Text>
      <ConfBar value={s.confidence || 0} color={C.teal} />
      <View style={styles.metricGrid}>
        <MetricBox label="Fish"   value={String(s.fishCount ?? 0)} color={C.teal}   accent={C.teal} />
        <MetricBox label="Depth"  value={s.depth || "—"}           color={C.blue}   accent={C.blue} />
        <MetricBox label="Arches" value={s.archCount != null ? String(s.archCount) : "—"} accent="#ffffff" />
        <MetricBox label="Barra%" value={s.barraPct != null ? `${s.barraPct}%` : "—"}
          color={s.barraPct != null && s.barraPct > 60 ? C.gold : undefined} accent={C.gold} />
      </View>
      {!!s.suggestion && <InfoBlock text={s.suggestion} borderColor={C.teal} />}
    </View>
  );
}

function PanelBarra({ s }: { s: HudData | null | undefined }) {
  if (!s) return <WaitingContent sub="Run a sonar scan to see barra profile." />;
  return (
    <View style={styles.panelBody}>
      <View style={styles.heroRow}>
        <Text style={[styles.heroVal, { color: C.gold }]}>{s.barraPct != null ? String(s.barraPct) : "—"}</Text>
        <Text style={[styles.heroSub, { color: C.dim }]}>% match</Text>
      </View>
      <View style={[styles.metricGrid, { gridTemplateColumns: undefined }]}>
        <View style={styles.metricRow}>
          <MetricBox label="Arches" value={s.archCount != null ? String(s.archCount) : "—"} color={C.gold} accent={C.gold} />
          <MetricBox label="Depth"  value={s.depth || "—"} color={C.gold} accent={C.gold} />
        </View>
      </View>
      <InfoBlock
        text={s.archShape || "No arch shape data — run boat mode scan for trophy barra analysis"}
        borderColor={C.gold}
      />
      {!!(s.bottomType || s.waterTemp) && (
        <InfoBlock
          text={[s.bottomType ? `Bottom: ${s.bottomType}` : null, s.waterTemp ? `Temp: ${s.waterTemp}` : null].filter(Boolean).join("  ·  ")}
          borderColor="#ffffff20"
          bgColor="#ffffff07"
        />
      )}
    </View>
  );
}

function PanelEnvironment({ tide, env, s }: { tide?: TideContext | null; env?: EnvContext; s?: HudData | null }) {
  return (
    <View style={styles.panelBody}>
      <Text style={[styles.heroText, { color: C.blue, fontSize: 18, lineHeight: 26 }]} numberOfLines={3}>
        {tide?.phase || "Loading tide data…"}
      </Text>
      <View style={styles.metricRow3}>
        <MetricBox label="Tide"
          value={tide?.state === "rising" ? "↑ Rising" : tide?.state === "falling" ? "↓ Falling" : tide?.state === "high" ? "⬆ HIGH" : tide?.state === "low" ? "⬇ LOW" : "—"}
          color={C.blue} accent={C.blue}
        />
        <MetricBox label="Next" value={tide?.nextTide?.type || "—"} />
        <MetricBox label="Water°" value={(s?.waterTemp) || "—"} />
      </View>
      {!!(tide?.nextTide) && (
        <InfoBlock
          text={`Next ${tide.nextTide.type} at ${tide.nextTide.time} — ${tide.nextTide.height}m`}
          borderColor={C.blue}
        />
      )}
      <View style={styles.tagRow}>
        {!!env?.season    && <View style={[styles.envTag, { borderColor: C.teal  + "88" }]}><Text style={[styles.envTagText, { color: C.teal  }]}>{env.season}</Text></View>}
        {!!env?.moonPhase && <View style={[styles.envTag, { borderColor: "#ffffff44" }]}><Text style={[styles.envTagText, { color: C.dim   }]}>{env.moonPhase}</Text></View>}
        {!!env?.timeOfDay && <View style={[styles.envTag, { borderColor: C.amber + "88" }]}><Text style={[styles.envTagText, { color: C.amber }]}>{env.timeOfDay}</Text></View>}
      </View>
    </View>
  );
}

function PanelBirds({ s }: { s: HudData | null | undefined }) {
  const hasBird = !!(s?.birdAlert || s?.birdActivity);
  const hasBait = !!s?.baitSchool;
  const hasAny  = hasBird || hasBait;
  return (
    <View style={styles.panelBody}>
      {!hasAny ? (
        <View style={styles.centreBody}>
          <Text style={styles.centreTitle}>No surface activity detected</Text>
          <Text style={styles.centreSub}>Scan with camera or boat mode to detect bird feeding and bait balls.</Text>
        </View>
      ) : (
        <>
          <View style={styles.tagRow}>
            {hasBird && <View style={[styles.envTag, { borderColor: C.cyan + "99" }]}><Text style={[styles.envTagText, { color: C.cyan }]}>🐦 {s?.birdAlert ?? s?.birdActivity}</Text></View>}
            {hasBait && <View style={[styles.envTag, { borderColor: C.gold + "99" }]}><Text style={[styles.envTagText, { color: C.gold }]}>🐟 Bait School Detected</Text></View>}
          </View>
          <InfoBlock
            text={(s?.birdActivity ?? s?.birdAlert ?? "Surface activity detected") + (hasBait ? " · Sonar confirms bait school beneath." : "")}
            borderColor={C.cyan}
          />
        </>
      )}
      <View style={[styles.metricRow2, { marginTop: "auto" as any }]}>
        <MetricBox label="Clarity"    value={s?.waterClarity || "—"} color={C.blue} />
        <MetricBox label="Sonar Mode" value={s?.sonarMode    || "—"} color={C.dim}  />
      </View>
    </View>
  );
}

function PanelCroc({ s }: { s: HudData | null | undefined }) {
  const alert = s?.crocAlert ?? false;
  return (
    <View style={styles.panelBody}>
      {!alert ? (
        <View style={styles.centreBody}>
          <Text style={{ fontSize: 48, textAlign: "center" }}>✅</Text>
          <Text style={[styles.centreTitle, { color: C.green, letterSpacing: 1 }]}>AREA CLEAR</Text>
          <Text style={styles.centreSub}>No croc threats detected.{"\n"}Always stay vigilant near water.</Text>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 40 }}>🐊</Text>
            <View>
              <Text style={[styles.centreTitle, { color: C.red, letterSpacing: 1 }]}>CROC ALERT</Text>
              <Text style={[styles.centreSub, { marginTop: 0 }]}>Saltwater crocodile detected</Text>
            </View>
          </View>
          <InfoBlock
            text={s?.crocWarning || "Crocodile detected — move position immediately"}
            borderColor={C.red}
          />
          <InfoBlock
            text="Keep clear of water's edge. Do not attempt to retrieve lures near croc sighting. Move position immediately."
            borderColor="#ffffff20"
            bgColor="#ffffff07"
          />
        </>
      )}
    </View>
  );
}

function PanelWater({ s }: { s: HudData | null | undefined }) {
  if (!s) return <WaitingContent sub="Run a sonar scan to see water conditions." />;
  return (
    <View style={styles.panelBody}>
      <View style={styles.metricRow2}>
        <MetricBox label="Water Temp"  value={s.waterTemp    || "—"} color={C.blue}  accent={C.blue}  />
        <MetricBox label="Clarity"     value={s.waterClarity || "—"}                                  />
      </View>
      <View style={styles.metricRow2}>
        <MetricBox label="Bottom Type" value={s.bottomType   || "—"} color={C.amber} accent={C.amber} />
        <MetricBox label="Sonar Mode"  value={s.sonarMode    || "—"} color={C.dim}                    />
      </View>
      <InfoBlock
        text={s.lure ? `Current lure: ${s.lure}` : "No lure data — tap boat mode for lure recommendation"}
        borderColor={C.amber}
      />
    </View>
  );
}

function PanelCommunity({ c }: { c?: CommunityContext | null }) {
  if (!c?.reportCount) {
    return (
      <View style={styles.panelBody}>
        <View style={styles.centreBody}>
          <Text style={styles.centreTitle}>No community data yet</Text>
          <Text style={styles.centreSub}>Submit scans to build the community intelligence database.</Text>
        </View>
      </View>
    );
  }
  const top = (c.hotSpecies || []).slice(0, 5);
  const maxCnt = top.length ? (top[0].count || 1) : 1;
  return (
    <View style={styles.panelBody}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Text style={[styles.metricLbl, { color: C.dim }]}>TOP SPECIES</Text>
        <Text style={[styles.metricLbl, { color: C.dimmer }]}>{c.reportCount} reports</Text>
      </View>
      <View style={{ gap: 5 }}>
        {top.map((sp) => (
          <View key={sp.species} style={styles.spRow}>
            <Text style={styles.spName} numberOfLines={1}>{sp.species}</Text>
            <View style={styles.spBarWrap}>
              <View style={[styles.spBar, { width: `${Math.round((sp.count / maxCnt) * 100)}%` as any }]} />
            </View>
            <Text style={styles.spCnt}>{sp.count}</Text>
          </View>
        ))}
      </View>
      {!!(c.tips?.[0] || c.summary) && (
        <InfoBlock text={c.tips?.[0] ?? c.summary} borderColor={C.cyan} />
      )}
    </View>
  );
}

function PanelAITarget({ b }: { b?: BrainTarget | null }) {
  if (!b) {
    return (
      <View style={styles.panelBody}>
        <View style={styles.centreBody}>
          <Text style={styles.centreTitle}>Compiling brain…</Text>
          <Text style={styles.centreSub}>AI is analysing tides, community data and sonar.</Text>
        </View>
      </View>
    );
  }
  const reasoning = [b.reasoning, b.tideNote, b.seasonNote, b.communityNote].filter(Boolean).join(" ");
  return (
    <View style={styles.panelBody}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text style={[styles.heroSpecies, { color: C.gold, flex: 1 }]} numberOfLines={2}>{b.targetSpecies || "—"}</Text>
        <UrgencyTag urgency={b.urgency} />
      </View>
      <ConfBar value={b.confidence || 0} color={C.gold} />
      <View style={styles.metricRow2}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.microLabel, { color: C.dim }]}>DEPTH</Text>
          <Text style={[styles.fieldText, { color: C.blue }]} numberOfLines={2}>{b.targetDepth || "—"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.microLabel, { color: C.dim }]}>LURE</Text>
          <Text style={[styles.fieldText, { color: C.gold }]} numberOfLines={2}>{b.targetLure || "—"}</Text>
        </View>
      </View>
      <View>
        <Text style={[styles.microLabel, { color: C.dim }]}>CAST ZONE</Text>
        <Text style={[styles.fieldText, { color: C.cyan }]} numberOfLines={2}>{b.castZone || "—"}</Text>
      </View>
      <View>
        <Text style={[styles.microLabel, { color: C.dim }]}>TECHNIQUE</Text>
        <Text style={[styles.techniqueText]} numberOfLines={3}>{b.targetTechnique || "—"}</Text>
      </View>
      {!!reasoning && <InfoBlock text={reasoning} borderColor={C.gold} bgColor={C.gold + "09"} />}
    </View>
  );
}

function WaitingContent({ sub }: { sub: string }) {
  return (
    <View style={styles.centreBody}>
      <Text style={styles.centreTitle}>No data yet</Text>
      <Text style={styles.centreSub}>{sub}</Text>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HudTab() {
  const insets = useSafeAreaInsets();
  const [data,    setData]    = useState<HudState | null>(null);
  const [panelIdx, setPanelIdx] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [clock,    setClock]    = useState("");
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelRef  = useRef(0);
  const elapsedRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Live clock
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(
        [n.getHours(), n.getMinutes(), n.getSeconds()]
          .map((v) => String(v).padStart(2, "0"))
          .join(":")
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Live dot pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Panel rotation
  useEffect(() => {
    const id = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= PANEL_SECS) {
        elapsedRef.current = 0;
        panelRef.current = (panelRef.current + 1) % PANEL_COUNT;
        setPanelIdx(panelRef.current);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const jumpPanel = useCallback((idx: number) => {
    panelRef.current = idx;
    elapsedRef.current = 0;
    setElapsed(0);
    setPanelIdx(idx);
  }, []);

  // Data polling
  const fetchData = useCallback(async () => {
    if (!HUD_DATA_URL) return;
    try {
      const r = await fetch(HUD_DATA_URL, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error("non-ok");
      setData(await r.json() as HudState);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const scan      = data?.scan      ?? null;
  const brain     = data?.brain     ?? null;
  const tide      = data?.tide      ?? null;
  const community = data?.community ?? null;
  const env       = data?.env;
  const hasData   = !!(data?.updatedAt || data?.brainUpdatedAt);
  const srcLabel  = scan?.source === "boat" ? "⚓ Boat" : scan?.source === "cam2" ? "📺 Cam 2" : "📱 Live";
  const srcAgo    = scan?.updatedAt ? Math.round((Date.now() - scan.updatedAt) / 1000) : 0;
  const srcInfo   = scan ? `${srcLabel} · ${srcAgo < 5 ? "just now" : srcAgo + "s ago"}` : "";

  const progressPct = ((PANEL_SECS - elapsed) / PANEL_SECS) * 100;
  const panelColor  = PANEL_COLORS[panelIdx] ?? C.teal;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>⚡ HOOKVISION BRAIN</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.clockText}>{clock}</Text>
          <Animated.View style={[styles.liveDot, { opacity: pulseAnim, backgroundColor: hasData ? (brain ? C.gold : C.teal) : "#ffffff1a" }]} />
        </View>
      </View>

      {/* ── Panel area ── */}
      <View style={styles.panelArea}>
        {!hasData ? (
          <View style={styles.waitBox}>
            <MaterialCommunityIcons name="radar" size={44} color="#00d4aa44" />
            <Text style={styles.waitTitle}>Brain Initialising</Text>
            <Text style={styles.waitSub}>Compiling tides · community · AI prediction{"\n"}Run a sonar scan in HookVision to push data</Text>
          </View>
        ) : (
          <>
            <View style={styles.panelLabelRow}>
              <Text style={[styles.panelLabel, { color: panelColor }]}>{PANEL_NAMES[panelIdx]}</Text>
              <View style={[styles.panelLabelLine, { backgroundColor: panelColor + "33" }]} />
            </View>

            {panelIdx === 0 && <PanelSonar       s={scan}                               />}
            {panelIdx === 1 && <PanelBarra        s={scan}                               />}
            {panelIdx === 2 && <PanelEnvironment  tide={tide}  env={env}  s={scan}      />}
            {panelIdx === 3 && <PanelBirds        s={scan}                               />}
            {panelIdx === 4 && <PanelCroc         s={scan}                               />}
            {panelIdx === 5 && <PanelWater        s={scan}                               />}
            {panelIdx === 6 && <PanelCommunity    c={community}                          />}
            {panelIdx === 7 && <PanelAITarget     b={brain}                              />}
          </>
        )}
      </View>

      {/* ── Footer ── */}
      {hasData && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 4 }]}>
          <View style={styles.footerRow}>
            <Text style={[styles.panelNameLabel, { color: panelColor }]}>{PANEL_NAMES[panelIdx].toUpperCase()}</Text>
            <Text style={styles.sourceInfo}>{srcInfo}</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progTrack}>
            <View style={[styles.progBar, { width: `${progressPct}%` as any, backgroundColor: panelColor }]} />
          </View>

          {/* Panel dots */}
          <View style={styles.dotsRow}>
            {PANEL_COLORS.map((col, i) => (
              <TouchableOpacity key={i} onPress={() => jumpPanel(i)} hitSlop={8}>
                <View style={[
                  styles.dot,
                  { backgroundColor: i === panelIdx ? col : "#ffffff1a" },
                  i === panelIdx && { transform: [{ scale: 1.4 }] },
                ]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.navy },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#ffffff0d",
  },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand:  { color: C.teal, fontSize: 11, fontWeight: "900", letterSpacing: 3 },
  clockText: { color: C.dim, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  liveDot: { width: 8, height: 8, borderRadius: 4 },

  panelArea: { flex: 1, padding: 14, gap: 8 },
  panelLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  panelLabel:    { fontSize: 9, fontWeight: "900", letterSpacing: 3, textTransform: "uppercase" },
  panelLabelLine: { flex: 1, height: 1 },

  panelBody: { flex: 1, gap: 8 },

  // Hero text
  heroSpecies: { fontSize: 28, fontWeight: "900", lineHeight: 34, letterSpacing: -0.5 },
  heroVal:  { fontSize: 36, fontWeight: "900", lineHeight: 1.05 * 36, letterSpacing: -0.5 },
  heroSub:  { fontSize: 14, fontWeight: "500", marginLeft: 6 },
  heroRow:  { flexDirection: "row", alignItems: "baseline" },
  heroText: { fontWeight: "900", letterSpacing: -0.3 },

  // Metric grids
  metricGrid: { flexDirection: "row", gap: 6 },
  metricRow:  { flexDirection: "row", gap: 6, flex: 1 },
  metricRow2: { flexDirection: "row", gap: 6 },
  metricRow3: { flexDirection: "row", gap: 6 },
  metricBox: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 1,
    paddingVertical: 8, paddingHorizontal: 4,
    borderWidth: 1, borderColor: "#ffffff10", borderRadius: 10,
    backgroundColor: "#ffffff06",
  },
  metricVal: { fontSize: 20, fontWeight: "900", lineHeight: 22, color: "#fff" },
  metricLbl: { fontSize: 8, fontWeight: "700", letterSpacing: 1.5, color: C.dim, textTransform: "uppercase" },

  // Conf bar
  confRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  confTrack: { flex: 1, height: 4, backgroundColor: "#ffffff12", borderRadius: 2, overflow: "hidden" },
  confFill:  { height: "100%" as any, borderRadius: 2 },
  confPct:   { fontSize: 14, fontWeight: "800", minWidth: 36, textAlign: "right" },

  // Info block
  infoBlock: { borderLeftWidth: 3, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10, paddingLeft: 10 },
  infoBlockText: { color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "500", lineHeight: 18 },

  // Urgency tag
  urgTag: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  urgTagText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },

  // Env tags
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  envTag: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#ffffff08" },
  envTagText: { fontSize: 10, fontWeight: "700" },

  // Centre states
  waitBox:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  waitTitle:  { color: C.dim, fontSize: 15, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", textAlign: "center" },
  waitSub:    { color: C.dimmer, fontSize: 12, textAlign: "center", lineHeight: 20 },
  centreBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  centreTitle: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
  centreSub:   { color: C.dim,  fontSize: 12, textAlign: "center", lineHeight: 18 },

  // Species/community list
  spRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  spName:   { fontSize: 13, fontWeight: "700", color: "#fff", flex: 1 },
  spBarWrap: { width: 80, height: 3, backgroundColor: "#ffffff12", borderRadius: 2, overflow: "hidden" },
  spBar:    { height: "100%" as any, backgroundColor: C.cyan, borderRadius: 2 },
  spCnt:    { fontSize: 10, fontWeight: "700", color: C.dim, minWidth: 28, textAlign: "right" },

  // AI target fields
  microLabel:   { fontSize: 8, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 },
  fieldText:    { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  techniqueText: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.75)", lineHeight: 18 },

  // Footer
  footer: {
    borderTopWidth: 1, borderTopColor: "#ffffff0d",
    paddingHorizontal: 16, paddingTop: 6, gap: 5,
  },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  panelNameLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  sourceInfo:     { fontSize: 9, color: C.dimmer },
  progTrack: { width: "100%", height: 2, backgroundColor: "#ffffff0f", borderRadius: 1, overflow: "hidden" },
  progBar:   { height: "100%" as any, borderRadius: 1 },
  dotsRow:   { flexDirection: "row", justifyContent: "center", gap: 7, paddingVertical: 4 },
  dot:       { width: 5, height: 5, borderRadius: 3 },
});
