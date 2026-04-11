import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  CHARACTERS,
  LANGUAGES,
  type NarratorCharacter,
  type NarratorLanguage,
  useNarrator,
} from "@/context/NarratorContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function NarratorSettings({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { character, language, setCharacter, setLanguage, speak } = useNarrator();

  const handleCharacter = (c: NarratorCharacter) => {
    setCharacter(c);
    const demos: Record<NarratorCharacter, string> = {
      AUSSIE:       "G'day mate! Bloody ripper conditions out there today — let's go find us a big barra!",
      BENAUD:       "Marvellous. The conditions today are simply magnificent. One ball, perfectly delivered to the tidal zone.",
      CHOPPER:      "Listen here ya mug — I'll tell ya exactly where the fish are, and ya better be grateful.",
      ATTENBOROUGH: "Here, in the ancient waters of the Northern Territory, a magnificent barramundi awaits.",
    };
    setTimeout(() => speak(demos[c]), 200);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Narrator Settings</Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
            <Feather name="x" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Character selection */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CHOOSE YOUR NARRATOR</Text>
          <View style={styles.charGrid}>
            {CHARACTERS.map((c) => {
              const selected = character === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.charCard,
                    {
                      backgroundColor: selected ? `${c.color}18` : colors.card,
                      borderColor: selected ? c.color : colors.border,
                    },
                  ]}
                  onPress={() => handleCharacter(c.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.charEmoji}>{c.emoji}</Text>
                  <Text style={[styles.charName, { color: selected ? c.color : colors.foreground }]}>
                    {c.name}
                  </Text>
                  <Text style={[styles.charTagline, { color: colors.mutedForeground }]}>
                    {c.tagline}
                  </Text>
                  {selected && (
                    <View style={[styles.selectedDot, { backgroundColor: c.color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Language selection */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NARRATION LANGUAGE</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((l) => {
              const selected = language === l.code;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[
                    styles.langChip,
                    {
                      backgroundColor: selected ? `${colors.primary}22` : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setLanguage(l.code as NarratorLanguage)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.langFlag}>{l.flag}</Text>
                  <Text style={[styles.langName, { color: selected ? colors.primary : colors.foreground }]}>
                    {l.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Tap any narrator button on any page to hear the AI describe what's on screen in your selected character's voice and language.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Trigger button (used in tab headers) ────────────────────────────────────
export function NarratorSettingsTrigger() {
  const [open, setOpen] = useState(false);
  const colors = useColors();
  const { character } = useNarrator();
  const charInfo = CHARACTERS.find((c) => c.id === character) ?? CHARACTERS[0];

  return (
    <>
      <TouchableOpacity
        style={[styles.triggerBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.triggerEmoji}>{charInfo.emoji}</Text>
        <Feather name="settings" size={12} color={colors.mutedForeground} />
      </TouchableOpacity>
      <NarratorSettings visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  content: { paddingHorizontal: 20, paddingTop: 20, gap: 14, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 1,
  },

  charGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  charCard: {
    width: "47%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  charEmoji: { fontSize: 28 },
  charName: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  charTagline: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 15 },
  selectedDot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },

  langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  langChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  langFlag: { fontSize: 16 },
  langName: { fontSize: 13, fontFamily: "Inter_500Medium" },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  triggerBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1,
  },
  triggerEmoji: { fontSize: 14 },
});
