import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/contexts/SettingsContext";
import { playBeep, playSiren, speakTest } from "@/hooks/useAudioAlert";

interface CrocGuardConfig {
  thresholds: {
    red_visual: number;
    orange_sonar_only: number;
    red_combined_boost: number;
  };
  decay: {
    red_to_orange_s: number;
    orange_to_green_s: number;
  };
}

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const [urlDraft, setUrlDraft] = useState(settings.apiBaseUrl);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<CrocGuardConfig | null>(null);
  const [configError, setConfigError] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${settings.apiBaseUrl}/api/crocguard/config`);
      const json = (await res.json()) as CrocGuardConfig & { ok: boolean };
      setConfig(json);
      setConfigError(false);
    } catch {
      setConfigError(true);
    }
  }, [settings.apiBaseUrl]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveUrl = async () => {
    const trimmed = urlDraft.trim().replace(/\/$/, "");
    if (!trimmed) {
      Alert.alert("Invalid URL", "Please enter a valid API base URL.");
      return;
    }
    setSaving(true);
    await updateSettings({ apiBaseUrl: trimmed });
    setSaving(false);
    Alert.alert("Saved", "Device URL updated. Polling will use the new address.");
  };

  const toggleAudio = async (val: boolean) => {
    await updateSettings({ audioEnabled: val });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.pageTitle}>⚙️ Settings</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Connection</Text>
            <Text style={styles.hint}>
              Enter the base URL of the CrocGuard device or the API server (e.g.{"\n"}
              https://yourapp.replit.dev or http://192.168.1.50:8080)
            </Text>
            <TextInput
              style={styles.input}
              value={urlDraft}
              onChangeText={setUrlDraft}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://your-api-server"
              placeholderTextColor="#4b5563"
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveUrl}
              disabled={saving}
            >
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save URL"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Audio Alerts</Text>
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Enable sound alerts</Text>
                <Text style={styles.toggleHint}>
                  Beep on orange, siren + voice on red
                </Text>
              </View>
              <Switch
                value={settings.audioEnabled}
                onValueChange={toggleAudio}
                trackColor={{ false: "#374151", true: "#166534" }}
                thumbColor={settings.audioEnabled ? "#22c55e" : "#6b7280"}
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Alert Sensitivity</Text>
              <TouchableOpacity onPress={fetchConfig}>
                <Feather name="refresh-cw" size={14} color="#4ade80" />
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Detection thresholds configured on the CrocGuard device (read-only).
            </Text>

            {configError && (
              <Text style={styles.configError}>
                Cannot reach device — showing defaults when available.
              </Text>
            )}

            {config ? (
              <View style={styles.thresholdGrid}>
                <View style={styles.thresholdCard}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#ef4444" }]} />
                  <Text style={styles.thresholdLabel}>Red — Visual</Text>
                  <Text style={styles.thresholdVal}>{config.thresholds.red_visual}%</Text>
                  <Text style={styles.thresholdHint}>confidence to trigger RED</Text>
                </View>
                <View style={styles.thresholdCard}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#f97316" }]} />
                  <Text style={styles.thresholdLabel}>Orange — Sonar</Text>
                  <Text style={styles.thresholdVal}>{config.thresholds.orange_sonar_only}%</Text>
                  <Text style={styles.thresholdHint}>max sonar-only confidence</Text>
                </View>
                <View style={styles.thresholdCard}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#22c55e" }]} />
                  <Text style={styles.thresholdLabel}>Red Decay</Text>
                  <Text style={styles.thresholdVal}>{config.decay.red_to_orange_s}s</Text>
                  <Text style={styles.thresholdHint}>RED → ORANGE silence</Text>
                </View>
                <View style={styles.thresholdCard}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#22c55e" }]} />
                  <Text style={styles.thresholdLabel}>Orange Decay</Text>
                  <Text style={styles.thresholdVal}>{config.decay.orange_to_green_s}s</Text>
                  <Text style={styles.thresholdHint}>ORANGE → GREEN silence</Text>
                </View>
              </View>
            ) : !configError ? (
              <Text style={styles.loadingText}>Loading thresholds…</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔊 Test Sounds</Text>
            <Text style={styles.hint}>
              Verify the acoustic deterrent works on this device before deploying at the boat ramp.
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: "#1c3f1c", borderWidth: 1, borderColor: "#22c55e66" }]}
              onPress={() => { void playBeep(); }}
            >
              <Text style={{ fontSize: 16 }}>🔔</Text>
              <Text style={styles.saveBtnText}>Test Beep  (Orange Alert)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: "#3f1c1c", borderWidth: 1, borderColor: "#ef444466" }]}
              onPress={() => { void playSiren(); }}
            >
              <Text style={{ fontSize: 16 }}>🚨</Text>
              <Text style={styles.saveBtnText}>Test Siren  (Red Alert)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: "#1c2b3f", borderWidth: 1, borderColor: "#3b82f666" }]}
              onPress={() => speakTest()}
            >
              <Text style={{ fontSize: 16 }}>🗣️</Text>
              <Text style={styles.saveBtnText}>Test Voice Warning</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutKey}>App</Text>
              <Text style={styles.aboutVal}>CrocGuard v1.0</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutKey}>API endpoint</Text>
              <Text style={styles.aboutVal} numberOfLines={1}>{settings.apiBaseUrl}</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutKey}>Online poll</Text>
              <Text style={styles.aboutVal}>every 2 seconds</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutKey}>Offline retry</Text>
              <Text style={styles.aboutVal}>every 5 seconds</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1f0f" },
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 24 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 4 },
  section: {
    backgroundColor: "#052e16",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#166534",
    padding: 18,
    gap: 12,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#4ade80" },
  hint: { fontSize: 12, color: "#6b7280", lineHeight: 18 },
  input: {
    backgroundColor: "#0f2c1a",
    color: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#166534",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "monospace",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#166534",
    borderRadius: 8,
    paddingVertical: 10,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: { color: "#fff", fontSize: 14, fontWeight: "600" },
  toggleHint: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  configError: { color: "#f97316", fontSize: 12, fontStyle: "italic" },
  loadingText: { color: "#4b7a52", fontSize: 13, fontStyle: "italic" },
  thresholdGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thresholdCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: "#0f2c1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#166534",
    padding: 12,
    gap: 3,
  },
  thresholdDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  thresholdLabel: { color: "#86efac", fontSize: 11, fontWeight: "600" },
  thresholdVal: { color: "#fff", fontSize: 20, fontWeight: "900" },
  thresholdHint: { color: "#4b5563", fontSize: 10 },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aboutKey: { color: "#86efac", fontSize: 13 },
  aboutVal: { color: "#fff", fontSize: 13, flex: 1, textAlign: "right" },
});
