/**
 * Insta360 Dual-Pipeline Display Card
 * Shows Pipeline 1 (bait birds + bust-up) and Pipeline 2 (croc vision) results
 * with Left / Centre / Right zone indicators.
 */
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { SurfaceResult, CrocVisionResult } from "@/hooks/useInsta360Pipelines";

// ─── Zone bar ─────────────────────────────────────────────────────────────────
function ZoneBar({
  zones,
  activeColor,
  label,
}: {
  zones: { left: boolean; centre: boolean; right: boolean };
  activeColor: string;
  label: string;
}) {
  const inactive = "#ffffff18";
  return (
    <View style={styles.zoneRow}>
      <Text style={styles.zoneLabel}>{label}</Text>
      <View style={styles.zoneCells}>
        {(["left", "centre", "right"] as const).map((z) => (
          <View
            key={z}
            style={[
              styles.zoneCell,
              { backgroundColor: zones[z] ? activeColor + "55" : inactive,
                borderColor: zones[z] ? activeColor : "#ffffff22" },
            ]}
          >
            <Text style={[styles.zoneCellText, { color: zones[z] ? activeColor : "#ffffff44" }]}>
              {z === "centre" ? "CTR" : z.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Pipeline 1 card ──────────────────────────────────────────────────────────
function SurfacePipelineRow({ result, scanning }: { result: SurfaceResult | null; scanning: boolean }) {
  const urgencyColor =
    result?.urgency === "high"  ? "#ff8800" :
    result?.urgency === "low"   ? "#ffd700" : "#ffffff44";
  const urgencyBg =
    result?.urgency === "high"  ? "#ff880022" :
    result?.urgency === "low"   ? "#ffd70018" : "transparent";

  const typeIcons: Record<string, string> = {
    birds: "🐦", "bust-up": "💥", "bait-ball": "🌊", "surface-swirl": "🌀",
  };

  return (
    <View style={[styles.pipeSection, { borderColor: urgencyColor + "55", backgroundColor: urgencyBg }]}>
      {/* Header */}
      <View style={styles.pipeHeader}>
        <View style={styles.pipeHeaderLeft}>
          <Text style={styles.pipeIcon}>🐦</Text>
          <Text style={styles.pipeTitle}>SURFACE ACTIVITY</Text>
        </View>
        <View style={styles.pipeHeaderRight}>
          {scanning && <ActivityIndicator size="small" color="#ffd700" style={{ marginRight: 4 }} />}
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor + "33", borderColor: urgencyColor + "66" }]}>
            <Text style={[styles.urgencyText, { color: urgencyColor }]}>
              {result ? result.urgency.toUpperCase() : "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* Zone bar */}
      {result && (
        <ZoneBar
          zones={result.zones}
          activeColor={result.urgency === "high" ? "#ff8800" : "#ffd700"}
          label="Activity"
        />
      )}

      {/* Types */}
      {result?.types && result.types.length > 0 && (
        <View style={styles.typesRow}>
          {result.types.map((t) => (
            <View key={t} style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{typeIcons[t] ?? "•"} {t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Description */}
      {result?.description ? (
        <Text style={styles.pipeDesc} numberOfLines={2}>{result.description}</Text>
      ) : !scanning ? (
        <Text style={styles.pipeWaiting}>Waiting for first scan…</Text>
      ) : null}

      {/* Confidence */}
      {result && (
        <Text style={styles.pipeConf}>{result.confidence}% confidence</Text>
      )}
    </View>
  );
}

// ─── Pipeline 2 card ──────────────────────────────────────────────────────────
function CrocPipelineRow({ result, scanning }: { result: CrocVisionResult | null; scanning: boolean }) {
  const alertColor =
    result?.alertLevel === "confirmed" ? "#ff1744" :
    result?.alertLevel === "possible"  ? "#ff8800" : "#ffffff44";
  const alertBg =
    result?.alertLevel === "confirmed" ? "#ff174418" :
    result?.alertLevel === "possible"  ? "#ff880015" : "transparent";

  const partEmoji: Record<string, string> = {
    snout: "👃", eyes: "👀", head: "🐊", tail: "〰️", body: "🐊",
  };

  return (
    <View style={[styles.pipeSection, { borderColor: alertColor + "55", backgroundColor: alertBg }]}>
      {/* Header */}
      <View style={styles.pipeHeader}>
        <View style={styles.pipeHeaderLeft}>
          <Text style={styles.pipeIcon}>🐊</Text>
          <Text style={styles.pipeTitle}>CROC VISION</Text>
          {result?.sonarContributed && (
            <View style={[styles.sonarMergeBadge]}>
              <MaterialCommunityIcons name="radar" size={10} color="#00a8ff" />
              <Text style={styles.sonarMergeText}>+SONAR</Text>
            </View>
          )}
        </View>
        <View style={styles.pipeHeaderRight}>
          {scanning && <ActivityIndicator size="small" color="#ff1744" style={{ marginRight: 4 }} />}
          <View style={[styles.urgencyBadge, { backgroundColor: alertColor + "33", borderColor: alertColor + "66" }]}>
            <Text style={[styles.urgencyText, { color: alertColor }]}>
              {result ? result.alertLevel.toUpperCase() : "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* Zone bar */}
      {result && result.detected && (
        <ZoneBar
          zones={result.zones}
          activeColor={result.alertLevel === "confirmed" ? "#ff1744" : "#ff8800"}
          label="Croc zone"
        />
      )}

      {/* Parts detected */}
      {result?.parts && result.parts.length > 0 && (
        <View style={styles.typesRow}>
          {result.parts.map((p) => (
            <View key={p} style={[styles.typeBadge, { borderColor: alertColor + "55", backgroundColor: alertColor + "18" }]}>
              <Text style={[styles.typeBadgeText, { color: alertColor }]}>{partEmoji[p] ?? "•"} {p}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Description */}
      {result?.description ? (
        <Text style={styles.pipeDesc} numberOfLines={2}>{result.description}</Text>
      ) : !scanning ? (
        <Text style={styles.pipeWaiting}>Watching for crocs…</Text>
      ) : null}

      {/* Safety note */}
      {result?.safetyNote ? (
        <View style={styles.safetyRow}>
          <Feather name="alert-triangle" size={12} color="#ff1744" />
          <Text style={[styles.pipeDesc, { color: "#ff1744", flex: 1 }]} numberOfLines={2}>
            {result.safetyNote}
          </Text>
        </View>
      ) : null}

      {/* Confidence */}
      {result && (
        <Text style={styles.pipeConf}>{result.confidence}% confidence</Text>
      )}
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface Props {
  surface: SurfaceResult | null;
  croc: CrocVisionResult | null;
  scanning: boolean;
  running: boolean;
  scanCount: number;
  lastError: string | null;
  onStart: () => void;
  onStop: () => void;
}

export function Insta360PipelineCard({
  surface, croc, scanning, running, scanCount, lastError, onStart, onStop,
}: Props) {
  const hasAlert = croc?.alertLevel === "confirmed" || croc?.alertLevel === "possible";
  const hasSurface = surface?.urgency === "high" || surface?.urgency === "low";

  return (
    <View style={[
      styles.card,
      hasAlert && croc?.alertLevel === "confirmed" ? { borderColor: "#ff174466" } :
      hasAlert ? { borderColor: "#ff880044" } : { borderColor: "#00d4aa33" },
    ]}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialCommunityIcons name="camera-wireless" size={15} color="#00d4aa" />
          <Text style={styles.cardTitle}>INSTA360 PIPELINES</Text>
          {scanCount > 0 && (
            <View style={styles.scanCountBadge}>
              <Text style={styles.scanCountText}>{scanCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={running ? onStop : onStart}
          style={[
            styles.runBtn,
            running
              ? { backgroundColor: "#ff440022", borderColor: "#ff440066" }
              : { backgroundColor: "#00d4aa22", borderColor: "#00d4aa66" },
          ]}
          activeOpacity={0.8}
        >
          {running && scanning ? <ActivityIndicator size="small" color="#ff4400" /> : null}
          <Text style={[styles.runBtnText, { color: running ? "#ff4400" : "#00d4aa" }]}>
            {running ? "■ STOP" : "▶ START"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scan interval note */}
      {running && (
        <Text style={styles.intervalNote}>
          {scanning ? "Scanning now…" : `Auto-scanning every 6s · ${scanCount} scan${scanCount === 1 ? "" : "s"} done`}
        </Text>
      )}

      {/* Error */}
      {lastError && (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={12} color="#ff4400" />
          <Text style={styles.errorText} numberOfLines={1}>{lastError}</Text>
        </View>
      )}

      {/* Pipelines */}
      <SurfacePipelineRow result={surface} scanning={scanning && running} />
      <CrocPipelineRow   result={croc}    scanning={scanning && running} />

      {/* Legend */}
      <Text style={styles.legend}>
        Zones: LEFT · CTR · RIGHT  ·  Sonar croc data merged into Pipeline 2 when available
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0d1f3a",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  cardTitle: {
    color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 1,
  },
  scanCountBadge: {
    backgroundColor: "#00d4aa33", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1,
  },
  scanCountText: { color: "#00d4aa", fontSize: 11, fontWeight: "700" },
  runBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
  },
  runBtnText: { fontWeight: "700", fontSize: 12, letterSpacing: 0.5 },
  intervalNote: { color: "#ffffff66", fontSize: 11, marginTop: -4 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { color: "#ff4400", fontSize: 11, flex: 1 },

  pipeSection: {
    borderRadius: 12, borderWidth: 1, padding: 12, gap: 8,
  },
  pipeHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  pipeHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  pipeHeaderRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  pipeIcon: { fontSize: 16 },
  pipeTitle: { color: "#fff", fontWeight: "700", fontSize: 12, letterSpacing: 0.8 },
  urgencyBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  urgencyText: { fontWeight: "700", fontSize: 10, letterSpacing: 0.5 },

  zoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  zoneLabel: { color: "#ffffff66", fontSize: 10, width: 50 },
  zoneCells: { flex: 1, flexDirection: "row", gap: 4 },
  zoneCell: {
    flex: 1, alignItems: "center", borderRadius: 6, borderWidth: 1, paddingVertical: 4,
  },
  zoneCellText: { fontWeight: "700", fontSize: 10 },

  typesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typeBadge: {
    backgroundColor: "#ffffff12", borderRadius: 6, borderWidth: 1,
    borderColor: "#ffffff22", paddingHorizontal: 8, paddingVertical: 3,
  },
  typeBadgeText: { color: "#ffffffcc", fontSize: 11 },

  sonarMergeBadge: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "#00a8ff18", borderRadius: 6, borderWidth: 1,
    borderColor: "#00a8ff44", paddingHorizontal: 5, paddingVertical: 1,
  },
  sonarMergeText: { color: "#00a8ff", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },

  pipeDesc: { color: "#ffffffbb", fontSize: 11, lineHeight: 16 },
  pipeWaiting: { color: "#ffffff44", fontSize: 11, fontStyle: "italic" },
  pipeConf: { color: "#ffffff44", fontSize: 10, marginTop: -2 },

  safetyRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },

  legend: { color: "#ffffff33", fontSize: 9, textAlign: "center", marginTop: 2 },
});
