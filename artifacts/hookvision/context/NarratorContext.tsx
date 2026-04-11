import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { Platform } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────
export type NarratorCharacter = "AUSSIE" | "BENAUD" | "CHOPPER" | "ATTENBOROUGH";
export type NarratorLanguage =
  | "en-AU" | "ja-JP" | "zh-CN" | "id-ID"
  | "de-DE" | "fr-FR" | "es-ES" | "ko-KR"
  | "th-TH" | "vi-VN" | "pt-BR";

export interface CharacterInfo {
  id: NarratorCharacter;
  name: string;
  emoji: string;
  tagline: string;
  color: string;
}

export interface LanguageInfo {
  code: NarratorLanguage;
  name: string;
  flag: string;
}

export const CHARACTERS: CharacterInfo[] = [
  { id: "AUSSIE",       name: "NT Fishing Guide", emoji: "🎣", tagline: "Laconic, slang-heavy barra expert", color: "#00d4aa" },
  { id: "BENAUD",       name: "Richie Benaud",    emoji: "🏏", tagline: "Legendary cricket commentator",      color: "#ffd700" },
  { id: "CHOPPER",      name: "Chopper Read",     emoji: "🔪", tagline: "Melbourne's most colourful narrator", color: "#ff4500" },
  { id: "ATTENBOROUGH", name: "David Attenborough", emoji: "🌿", tagline: "Nature documentary reverence",    color: "#4a9eff" },
];

export const LANGUAGES: LanguageInfo[] = [
  { code: "en-AU", name: "English",    flag: "🇦🇺" },
  { code: "ja-JP", name: "日本語",     flag: "🇯🇵" },
  { code: "zh-CN", name: "中文",       flag: "🇨🇳" },
  { code: "id-ID", name: "Indonesia",  flag: "🇮🇩" },
  { code: "de-DE", name: "Deutsch",    flag: "🇩🇪" },
  { code: "fr-FR", name: "Français",   flag: "🇫🇷" },
  { code: "es-ES", name: "Español",    flag: "🇪🇸" },
  { code: "ko-KR", name: "한국어",     flag: "🇰🇷" },
  { code: "th-TH", name: "ภาษาไทย",   flag: "🇹🇭" },
  { code: "vi-VN", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "pt-BR", name: "Português",  flag: "🇧🇷" },
];

// ─── Context ──────────────────────────────────────────────────────────────────
interface NarratorCtx {
  character: NarratorCharacter;
  language: NarratorLanguage;
  speaking: boolean;
  loading: boolean;
  setCharacter: (c: NarratorCharacter) => void;
  setLanguage: (l: NarratorLanguage) => void;
  speak: (text: string) => void;
  narratePage: (pageType: string, content: string) => Promise<void>;
  stop: () => void;
}

const NarratorContext = createContext<NarratorCtx | null>(null);

// ─── Voice rates/pitch per character ─────────────────────────────────────────
const CHAR_VOICE: Record<NarratorCharacter, { rate: number; pitch: number }> = {
  AUSSIE:       { rate: 0.90, pitch: 0.72 },
  BENAUD:       { rate: 0.82, pitch: 0.68 },
  CHOPPER:      { rate: 1.05, pitch: 0.78 },
  ATTENBOROUGH: { rate: 0.78, pitch: 0.65 },
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NarratorProvider({ children }: { children: React.ReactNode }) {
  const [character, setCharacterState] = useState<NarratorCharacter>("AUSSIE");
  const [language, setLanguageState]   = useState<NarratorLanguage>("en-AU");
  const [speaking, setSpeaking]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const webUttRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Persist preferences
  useEffect(() => {
    AsyncStorage.multiGet(["narrator_character", "narrator_language"]).then(
      (pairs) => {
        const c = pairs[0][1] as NarratorCharacter | null;
        const l = pairs[1][1] as NarratorLanguage | null;
        if (c) setCharacterState(c);
        if (l) setLanguageState(l);
      }
    );
  }, []);

  const setCharacter = useCallback((c: NarratorCharacter) => {
    setCharacterState(c);
    AsyncStorage.setItem("narrator_character", c);
  }, []);

  const setLanguage = useCallback((l: NarratorLanguage) => {
    setLanguageState(l);
    AsyncStorage.setItem("narrator_language", l);
  }, []);

  const stop = useCallback(() => {
    if (Platform.OS === "web") {
      window.speechSynthesis?.cancel();
      webUttRef.current = null;
    } else {
      Speech.stop();
    }
    setSpeaking(false);
  }, []);

  // Unlock web speech synthesis within user gesture context
  const unlockWebSpeech = useCallback(() => {
    if (Platform.OS !== "web" || !("speechSynthesis" in window)) return;
    // Resume if paused (Chrome pauses after 15s of inactivity)
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    // Speak a zero-length utterance to satisfy Chrome's user-gesture requirement
    const unlock = new SpeechSynthesisUtterance("");
    unlock.volume = 0;
    window.speechSynthesis.speak(unlock);
    // Cancel immediately so it doesn't linger
    setTimeout(() => window.speechSynthesis.cancel(), 50);
  }, []);

  const speak = useCallback(
    (text: string) => {
      stop();
      const { rate, pitch } = CHAR_VOICE[character];

      if (Platform.OS === "web") {
        if (!("speechSynthesis" in window)) return;
        setSpeaking(true);
        // Ensure synthesis engine is running (can pause after idle)
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();

        const fire = (voices: SpeechSynthesisVoice[]) => {
          const preferred = [
            (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-") === language.toLowerCase(),
            (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith(language.split("-")[0].toLowerCase()),
            (v: SpeechSynthesisVoice) => /en/i.test(v.lang),
          ];
          let chosen: SpeechSynthesisVoice | undefined;
          for (const test of preferred) { chosen = voices.find(test); if (chosen) break; }

          const utt = new SpeechSynthesisUtterance(text);
          if (chosen) utt.voice = chosen;
          utt.lang = chosen?.lang ?? language;
          utt.rate = rate;
          utt.pitch = pitch;
          utt.volume = 1.0;
          utt.onend  = () => { setSpeaking(false); webUttRef.current = null; };
          utt.onerror = () => { setSpeaking(false); webUttRef.current = null; };
          webUttRef.current = utt;
          window.speechSynthesis.speak(utt);
        };

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) { fire(voices); }
        else { window.speechSynthesis.onvoiceschanged = () => fire(window.speechSynthesis.getVoices()); }
      } else {
        setSpeaking(true);
        Speech.speak(text, {
          language,
          rate,
          pitch,
          onDone:    () => setSpeaking(false),
          onError:   () => setSpeaking(false),
          onStopped: () => setSpeaking(false),
        });
      }
    },
    [character, language, stop]
  );

  const narratePage = useCallback(
    async (pageType: string, content: string) => {
      if (loading) return;
      setLoading(true);
      stop();
      // Unlock speech synthesis NOW while we still have the user gesture —
      // Chrome blocks speech that fires after an async gap (fetch await).
      unlockWebSpeech();
      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const baseUrl = domain ? `https://${domain}` : "";
        const resp = await fetch(`${baseUrl}/api/narrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, character, language, pageType }),
        });
        if (!resp.ok) throw new Error("Narrate failed");
        const { text } = await resp.json();
        if (text) speak(text);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    },
    [character, language, loading, speak, stop, unlockWebSpeech]
  );

  return (
    <NarratorContext.Provider
      value={{ character, language, speaking, loading, setCharacter, setLanguage, speak, narratePage, stop }}
    >
      {children}
    </NarratorContext.Provider>
  );
}

export function useNarrator() {
  const ctx = useContext(NarratorContext);
  if (!ctx) throw new Error("useNarrator must be used inside NarratorProvider");
  return ctx;
}
