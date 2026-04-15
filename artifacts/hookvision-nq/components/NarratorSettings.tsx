import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
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
  const { character, language, handsFree, setCharacter, setLanguage, setHandsFree, speak } = useNarrator();

  const DEMOS: Record<NarratorCharacter, string> = {
    AUSSIE:       "She's on, mate! Deadset ripper conditions — tide's dropping and the barra are stacked against the rock bar. Chuck on a white hardbody and work it slow. Let's smash 'em!",
    BENAUD:       "Marvellous. Simply marvellous. The tide has delivered the conditions — one of those mornings where the barramundi simply cannot resist. Oh, I say.",
    CHOPPER:      "Listen to me. I've fished these waters and I'll tell ya something for nothing, ya mug — the fish are right there. Don't be weak. Get in there.",
    ATTENBOROUGH: "Here, in the ancient flood plains of the Gulf Country, the barramundi has waited... patiently. And now — the moment of truth.",
    WIFE:         "Honestly, I cannot believe you're out there again. The gutters are full, your mother is coming over Sunday, and — fine, FINE. The tide's turning, fish the drop. You better bring something home.",
    ARNIE:        "Get to the boat! The barramundi is out there and I will find it. I've been in worse situations than this — and I never missed a target. I'll be back... with a trophy barra.",
    BURGUNDY:     "I'm Ron Burgundy, and this is a breaking fishing update. The tide is turning — much like my life at the afterparty of the 1984 San Diego Anchor Awards. Stay classy, Gulf Country.",
    IRWIN:        "Crikey! Look at the size of that barramundi — isn't she an absolute beauty! She's gonna have a go at us, mate, and I am HERE for it! You little ripper!",
    GRYLLS:       "In a situation like this, you must act fast. The tide is your enemy and your ally. Your body is your greatest survival tool — and right now, it's telling you: cast left, cast NOW.",
    RAMSAY:       "This barramundi is BEAUTIFUL. Look at that colour, that fight — stunning. But your technique? Oh dear. Come on. You're better than this. Get it TOGETHER.",
    MORGAN:       "There is something... timeless about a man standing at the water's edge. The barramundi beneath the surface has lived in these rivers for forty million years. And yet, somehow... he waits for you.",
    DUNDEE:       "You think that's a big fish? That's not a big fish. G'day mate — I've pulled crocs out of that same water with me bare hands. She'll be right. No worries.",
    YODA:         "Strong with the Force, this barramundi is. Patient, you must be. Do or do not — there is no cast-and-give-up. When 900 years you fish, this good you will be.",
    CONNERY:      "The name is Bass. Barramundi Bass. And I never miss. The tide is working in our favour — much like a well-placed Walther PPK. Shaken, not stirred.",
    BOBROSS:      "Let's paint ourselves a happy little cast right here. And maybe right here we'll add a happy little barramundi — because everyone needs a friend. There are no mistakes, only happy little misses.",
    SPARROW:      "But WHY is the rum gone? More importantly — why is the barramundi not on the hook? This is the day you'll always remember as the day you almost caught Captain Jack Sparrow's fish. Savvy?",
    TYSON:        "Everyone has a plan until the fish bites. My style is impetuous, my casting is impregnable. I am the Baddest Fisherman on the Planet. This barra doesn't know what's coming.",
    SAMUEL:       "I have HAD it with these fish in this Gulf Country water. You cast that line RIGHT NOW. Does he LOOK like a barramundi? Because I will tell you — that fish is MINE.",
    JEFF:         "The barramundi — and I find this fascinating, actually — the barramundi is... uh... it's a fish that has, through millions of years of, uh... life... finds a way. It always, uh... finds a way.",
    BOGAN:        "Oh FAAARK mate that is fully SICK conditions right now — deadset legend tide, absolute unit of a moon phase. Bloody oath you're getting onto fish today. What an absolute day to be alive!",
  };

  const handleCharacter = (c: NarratorCharacter) => {
    setCharacter(c);
    // Speak immediately — no setTimeout, so the user gesture is still live
    speak(DEMOS[c]);
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
          {/* Hands-free mode toggle */}
          <View style={[styles.handsFreeRow, { backgroundColor: colors.card, borderColor: handsFree ? "#00d4aa88" : colors.border }]}>
            <View style={styles.handsFreeLeft}>
              <Text style={styles.handsFreeIcon}>🤲</Text>
              <View style={styles.handsFreeTextCol}>
                <Text style={[styles.handsFreeTitle, { color: colors.foreground }]}>Hands-Free Mode</Text>
                <Text style={[styles.handsFreeDesc, { color: colors.mutedForeground }]}>
                  Auto-narrates each page so you can fish without touching the screen
                </Text>
              </View>
            </View>
            <Switch
              value={handsFree}
              onValueChange={setHandsFree}
              trackColor={{ false: colors.border, true: "#00d4aa" }}
              thumbColor={handsFree ? "#ffffff" : colors.mutedForeground}
            />
          </View>

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
                      backgroundColor: selected ? `${c.color}20` : colors.card,
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

          {/* Test voice button */}
          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: colors.card, borderColor: colors.primary }]}
            onPress={() => speak(DEMOS[character])}
            activeOpacity={0.8}
          >
            <Feather name="volume-2" size={15} color={colors.primary} />
            <Text style={[styles.testBtnText, { color: colors.primary }]}>Test Voice Now</Text>
          </TouchableOpacity>

          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Enable Hands-Free Mode above to auto-narrate every page — perfect for when your hands are busy fishing. Tap a character card to hear a demo voice.
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

  handsFreeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 14, borderWidth: 1.5, gap: 12,
  },
  handsFreeLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  handsFreeIcon: { fontSize: 28 },
  handsFreeTextCol: { flex: 1 },
  handsFreeTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  handsFreeDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 2 },

  charGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  charCard: {
    width: "30%",
    flexGrow: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
    position: "relative",
  },
  charEmoji: { fontSize: 24 },
  charName: { fontSize: 11, fontFamily: "Inter_700Bold", textAlign: "center" },
  charTagline: { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 13 },
  selectedDot: { position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 3.5 },

  langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  langChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  langFlag: { fontSize: 16 },
  langName: { fontSize: 13, fontFamily: "Inter_500Medium" },

  testBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 14, borderRadius: 12, borderWidth: 1.5,
  },
  testBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },

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
