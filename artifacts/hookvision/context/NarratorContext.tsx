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

// ─── Voice rates/pitch per character (native only) ────────────────────────────
const CHAR_VOICE: Record<NarratorCharacter, { rate: number; pitch: number }> = {
  AUSSIE:       { rate: 0.90, pitch: 0.72 },
  BENAUD:       { rate: 0.82, pitch: 0.68 },
  CHOPPER:      { rate: 1.05, pitch: 0.78 },
  ATTENBOROUGH: { rate: 0.78, pitch: 0.65 },
};

// ─── Web Audio engine (module-level, persists across renders) ─────────────────
// Using Web Audio API + OpenAI TTS endpoint instead of window.speechSynthesis,
// which is blocked in cross-origin iframes by browsers.
let _audioCtx: AudioContext | null = null;
let _audioSource: AudioBufferSourceNode | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return _audioCtx;
}

function stopWebAudio() {
  try {
    _audioSource?.stop();
    _audioSource?.disconnect();
  } catch {}
  _audioSource = null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NarratorProvider({ children }: { children: React.ReactNode }) {
  const [character, setCharacterState] = useState<NarratorCharacter>("AUSSIE");
  const [language, setLanguageState]   = useState<NarratorLanguage>("en-AU");
  const [speaking, setSpeaking]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const characterRef = useRef(character);
  const languageRef  = useRef(language);

  useEffect(() => { characterRef.current = character; }, [character]);
  useEffect(() => { languageRef.current  = language;  }, [language]);

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
      stopWebAudio();
    } else {
      Speech.stop();
    }
    setSpeaking(false);
  }, []);

  // ─── Web: unlock AudioContext in user gesture, then fetch + play TTS audio ──
  // Must call unlockAudioCtx() synchronously within the user gesture handler
  // BEFORE any await, so the AudioContext is in "running" state when we later
  // call source.start() after the async TTS fetch.
  const unlockAudioCtx = useCallback(() => {
    if (Platform.OS !== "web") return;
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch {}
  }, []);

  const playTTSAudio = useCallback(async (text: string) => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";

    setSpeaking(true);
    try {
      const resp = await fetch(`${baseUrl}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: languageRef.current }),
      });
      if (!resp.ok) throw new Error("TTS request failed");

      const arrayBuffer = await resp.arrayBuffer();
      const ctx = getAudioContext();

      // Resume if it got suspended while we were fetching
      if (ctx.state === "suspended") await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      stopWebAudio();

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => { setSpeaking(false); _audioSource = null; };
      source.start(0);
      _audioSource = source;
    } catch (err) {
      console.warn("[Narrator] TTS playback failed:", err);
      setSpeaking(false);
    }
  }, []);

  // ─── speak(): called directly (character demo, live camera) ─────────────────
  const speak = useCallback(
    (text: string) => {
      stop();
      if (Platform.OS === "web") {
        // Unlock AudioContext synchronously within user gesture, then fetch TTS
        unlockAudioCtx();
        playTTSAudio(text);
      } else {
        const { rate, pitch } = CHAR_VOICE[characterRef.current];
        setSpeaking(true);
        Speech.speak(text, {
          language: languageRef.current,
          rate,
          pitch,
          onDone:    () => setSpeaking(false),
          onError:   () => setSpeaking(false),
          onStopped: () => setSpeaking(false),
        });
      }
    },
    [stop, unlockAudioCtx, playTTSAudio]
  );

  // ─── narratePage(): fetches AI script then speaks it ────────────────────────
  const narratePage = useCallback(
    async (pageType: string, content: string) => {
      if (loading) return;
      setLoading(true);
      stop();

      // Unlock AudioContext NOW — synchronously within the user gesture.
      // After any await the browser may refuse to resume it.
      unlockAudioCtx();

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
        if (text) {
          if (Platform.OS === "web") {
            await playTTSAudio(text);
          } else {
            const { rate, pitch } = CHAR_VOICE[character];
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
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    },
    [character, language, loading, stop, unlockAudioCtx, playTTSAudio]
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
