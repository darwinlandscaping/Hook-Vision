import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
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

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const [urlDraft, setUrlDraft] = useState(settings.apiBaseUrl);
  const [saving, setSaving] = useState(false);

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
            <View style={styles.inputRow}>
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
            </View>
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
                  Beep on orange, siren + vibration on red
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
              <Text style={styles.aboutKey}>Poll interval</Text>
              <Text style={styles.aboutVal}>2 seconds</Text>
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
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#4ade80" },
  hint: { fontSize: 12, color: "#6b7280", lineHeight: 18 },
  inputRow: { gap: 8 },
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
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aboutKey: { color: "#86efac", fontSize: 13 },
  aboutVal: { color: "#fff", fontSize: 13, flex: 1, textAlign: "right" },
});
