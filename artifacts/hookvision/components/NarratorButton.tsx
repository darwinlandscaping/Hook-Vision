import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { CHARACTERS, useNarrator } from "@/context/NarratorContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  pageType: string;
  content: string;
  compact?: boolean;
}

export function NarratorButton({ pageType, content, compact = false }: Props) {
  const colors   = useColors();
  const { character, speaking, loading, transcript, narratePage, stop } = useNarrator();
  const charInfo = CHARACTERS.find((c) => c.id === character) ?? CHARACTERS[0];
  const active   = speaking || loading;

  const handlePress = () => {
    if (active) { stop(); return; }
    narratePage(pageType, content);
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compact,
          {
            backgroundColor: active ? `${charInfo.color}22` : colors.secondary,
            borderColor: active ? charInfo.color : colors.border,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color={charInfo.color} />
        ) : (
          <Feather
            name={speaking ? "volume-x" : "volume-2"}
            size={15}
            color={active ? charInfo.color : colors.mutedForeground}
          />
        )}
        <Text
          style={[
            styles.compactText,
            { color: active ? charInfo.color : colors.mutedForeground },
          ]}
        >
          {loading ? "Writing..." : speaking ? "Stop" : charInfo.emoji}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.full,
          {
            backgroundColor: active ? `${charInfo.color}18` : colors.card,
            borderColor: active ? charInfo.color : colors.border,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color={charInfo.color} />
        ) : (
          <Text style={styles.charEmoji}>{charInfo.emoji}</Text>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.charName, { color: active ? charInfo.color : colors.foreground }]}>
            {loading ? "Writing script..." : speaking ? `${charInfo.name} is speaking...` : `Listen — ${charInfo.name}`}
          </Text>
          {!loading && !transcript && (
            <Text style={[styles.charTagline, { color: colors.mutedForeground }]}>
              {charInfo.tagline}
            </Text>
          )}
        </View>
        <Feather
          name={speaking ? "volume-x" : "volume-2"}
          size={16}
          color={active ? charInfo.color : colors.mutedForeground}
        />
      </TouchableOpacity>

      {/* Transcript — always visible once narration has run */}
      {transcript ? (
        <View style={[styles.transcript, { backgroundColor: `${charInfo.color}12`, borderColor: `${charInfo.color}30` }]}>
          <Text style={[styles.transcriptText, { color: colors.foreground }]}>
            {transcript}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  compactText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  full: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
  },
  charEmoji: { fontSize: 22 },
  charName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  charTagline: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  transcript: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  transcriptText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
});
