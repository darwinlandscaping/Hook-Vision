import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useSettings } from "@/contexts/SettingsContext";

interface Camera {
  id: number;
  name: string;
  stream_url: string;
  type: string;
  status: string;
  last_seen: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "active" ? "#22c55e" : status === "inactive" ? "#6b7280" : "#f97316";
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

export default function CamerasScreen() {
  const { settings } = useSettings();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Camera | null>(null);

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch(`${settings.apiBaseUrl}/api/crocguard/cameras`);
      const json = (await res.json()) as { ok: boolean; cameras: Camera[] };
      setCameras(json.cameras);
      setError(null);
    } catch (e) {
      setError("Could not load cameras. Is the device online?");
    } finally {
      setLoading(false);
    }
  }, [settings.apiBaseUrl]);

  useEffect(() => {
    fetchCameras();
    const id = setInterval(fetchCameras, 10000);
    return () => clearInterval(id);
  }, [fetchCameras]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>📷 Live Cameras</Text>
          <TouchableOpacity onPress={fetchCameras}>
            <Feather name="refresh-cw" size={20} color="#4ade80" />
          </TouchableOpacity>
        </View>

        {loading && (
          <ActivityIndicator style={{ marginTop: 40 }} color="#22c55e" size="large" />
        )}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FlatList
          data={cameras}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No cameras registered.</Text>
                <Text style={styles.emptyHint}>Add cameras via the CrocGuard dashboard.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelected(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardRow}>
                <Feather name="video" size={20} color="#22c55e" />
                <Text style={styles.cameraName}>{item.name}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.cameraType}>{item.type.toUpperCase()}</Text>
              {item.last_seen && (
                <Text style={styles.lastSeen}>
                  Last seen: {new Date(item.last_seen).toLocaleTimeString()}
                </Text>
              )}
              <Text style={styles.tapHint}>Tap to view stream →</Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>

      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {selected && Platform.OS !== "web" ? (
            <WebView
              source={{ uri: selected.stream_url }}
              style={{ flex: 1 }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
          ) : (
            <View style={styles.webStreamFallback}>
              <Text style={styles.webStreamUrl}>{selected?.stream_url}</Text>
              <Text style={styles.webStreamHint}>
                Open this URL in your browser to view the stream.
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1f0f" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  card: {
    backgroundColor: "#14532d22",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#166534",
    padding: 16,
    gap: 6,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cameraName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "700" },
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  cameraType: { color: "#86efac", fontSize: 12, marginLeft: 30 },
  lastSeen: { color: "#6b7280", fontSize: 12, marginLeft: 30 },
  tapHint: { color: "#4ade80", fontSize: 12, textAlign: "right" },
  errorBox: {
    margin: 20,
    padding: 16,
    backgroundColor: "#450a0a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  errorText: { color: "#fca5a5", fontSize: 14, textAlign: "center" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#4ade80", fontSize: 18, fontWeight: "600" },
  emptyHint: { color: "#6b7280", fontSize: 13, marginTop: 8 },
  modalRoot: { flex: 1, backgroundColor: "#000" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#0d1f0f",
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1 },
  webStreamFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  webStreamUrl: { color: "#22c55e", fontSize: 14, textAlign: "center", marginBottom: 10 },
  webStreamHint: { color: "#6b7280", fontSize: 12, textAlign: "center" },
});
