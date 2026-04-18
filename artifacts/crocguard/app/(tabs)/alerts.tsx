import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/contexts/SettingsContext";

interface Alert {
  id: number;
  source: string;
  severity: string;
  confidence: number;
  resolved: boolean;
  resolved_at: string | null;
  timestamp: string;
  metadata: unknown;
}

const SEVERITY_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f97316",
  high: "#ef4444",
  critical: "#dc2626",
};

const SOURCE_LABELS: Record<string, string> = {
  sonar: "🔊 Sonar",
  visual: "👁 Visual",
  combined: "🔊👁 Combined",
  manual: "👤 Manual",
};

function formatTs(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AlertsScreen() {
  const { settings } = useSettings();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const res = await fetch(
          `${settings.apiBaseUrl}/api/crocguard/alerts?limit=50`
        );
        const json = (await res.json()) as {
          ok: boolean;
          alerts: Alert[];
          total: number;
        };
        setAlerts(json.alerts);
        setTotal(json.total);
      } catch {}
      setLoading(false);
      setRefreshing(false);
    },
    [settings.apiBaseUrl]
  );

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 5000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>🔔 Detection Log</Text>
            <Text style={styles.count}>{total} total events</Text>
          </View>
          <TouchableOpacity onPress={() => fetchAlerts(true)}>
            <Feather name="refresh-cw" size={20} color="#4ade80" />
          </TouchableOpacity>
        </View>

        {loading && (
          <ActivityIndicator style={{ marginTop: 40 }} color="#22c55e" size="large" />
        )}

        <FlatList
          data={alerts}
          keyExtractor={(a) => String(a.id)}
          refreshing={refreshing}
          onRefresh={() => fetchAlerts(true)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No detections recorded yet.</Text>
                <Text style={styles.emptyHint}>Alerts will appear here when the buoy detects activity.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const sevColor = SEVERITY_COLOR[item.severity] ?? "#6b7280";
            return (
              <View style={[styles.card, { borderLeftColor: sevColor }]}>
                <View style={styles.cardTop}>
                  <Text style={styles.sourceLabel}>
                    {SOURCE_LABELS[item.source] ?? item.source}
                  </Text>
                  <View style={[styles.sevBadge, { backgroundColor: sevColor + "33", borderColor: sevColor }]}>
                    <Text style={[styles.sevText, { color: sevColor }]}>
                      {item.severity.toUpperCase()}
                    </Text>
                  </View>
                  {item.resolved && (
                    <View style={styles.resolvedBadge}>
                      <Text style={styles.resolvedText}>RESOLVED</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardMid}>
                  <Text style={styles.confidence}>{item.confidence}% confidence</Text>
                  <Text style={styles.ts}>{formatTs(item.timestamp)}</Text>
                </View>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1f0f" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  count: { fontSize: 12, color: "#4ade80", marginTop: 2 },
  card: {
    backgroundColor: "#052e16",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#166534",
    borderLeftWidth: 4,
    padding: 14,
    gap: 6,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  sourceLabel: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
  sevBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sevText: { fontSize: 10, fontWeight: "800" },
  resolvedBadge: {
    backgroundColor: "#16534344",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resolvedText: { fontSize: 10, color: "#4ade80", fontWeight: "700" },
  cardMid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confidence: { color: "#86efac", fontSize: 13 },
  ts: { color: "#6b7280", fontSize: 12 },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 20 },
  emptyText: { color: "#4ade80", fontSize: 17, fontWeight: "600" },
  emptyHint: { color: "#6b7280", fontSize: 13, marginTop: 8, textAlign: "center" },
});
