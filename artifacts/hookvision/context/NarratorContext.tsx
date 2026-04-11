import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
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

// ─── Web Audio engine (module-level, persists across renders) ─────────────────
let _audioCtx: AudioContext | null = null;
let _audioSource: AudioBufferSourceNode | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return _audioCtx;
}

function stopWebAudio() {
  try { _audioSource?.stop(); _audioSource?.disconnect(); } catch {}
  _audioSource = null;
}

// ─── Native Audio (expo-av) ───────────────────────────────────────────────────
let _nativeSound: Audio.Sound | null = null;

async function stopNativeAudio() {
  if (_nativeSound) {
    try { await _nativeSound.stopAsync(); await _nativeSound.unloadAsync(); } catch {}
    _nativeSound = null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NarratorProvider({ children }: { children: React.ReactNode }) {
  const [character, setCharacterState] = useState<NarratorCharacter>("AUSSIE");
  const [language, setLanguageState]   = useState<NarratorLanguage>("en-AU");
  const [speaking, setSpeaking]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const languageRef = useRef(language);

  useEffect(() => { languageRef.current = language; }, [language]);

  // Configure expo-av audio session for native
  useEffect(() => {
    if (Platform.OS !== "web") {
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      }).catch(() => {});
    }
  }, []);

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
      stopNativeAudio();
    }
    setSpeaking(false);
  }, []);

  // ─── Web: unlock AudioContext within user gesture ────────────────────────────
  const unlockAudioCtx = useCallback(() => {
    if (Platform.OS !== "web") return;
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch {}
  }, []);

  // ─── Shared: build the TTS GET URL for native streaming ─────────────────────
  const ttsUrl = useCallback((text: string) => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    return `${baseUrl}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(languageRef.current)}`;
  }, []);

  // ─── Web: fetch TTS audio and play via Web Audio API ────────────────────────
  const playTTSWeb = useCallback(async (text: string) => {
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
      console.warn("[Narrator] Web TTS failed:", err);
      setSpeaking(false);
    }
  }, []);

  // ─── Native: play TTS audio via expo-av ─────────────────────────────────────
  const playTTSNative = useCallback(async (text: string) => {
    setSpeaking(true);
    await stopNativeAudio();
    try {
      const url = ttsUrl(text);
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 1.0 }
      );
      _nativeSound = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setSpeaking(false);
          sound.unloadAsync().catch(() => {});
          _nativeSound = null;
        }
      });
    } catch (err) {
      console.warn("[Narrator] Native TTS failed:", err);
      setSpeaking(false);
    }
  }, [ttsUrl]);

  // ─── speak(): called directly (character demo, live camera) ─────────────────
  const speak = useCallback(
    (text: string) => {
      stop();
      if (Platform.OS === "web") {
        unlockAudioCtx();
        playTTSWeb(text);
      } else {
        playTTSNative(text);
      }
    },
    [stop, unlockAudioCtx, playTTSWeb, playTTSNative]
  );

  // ─── narratePage(): fetches AI script then speaks it ────────────────────────
  const narratePage = useCallback(
    async (pageType: string, content: string) => {
      if (loading) return;
      setLoading(true);
      stop();
      // Unlock AudioContext synchronously within the user gesture (web only)
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
            await playTTSWeb(text);
          } else {
            await playTTSNative(text);
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    },
    [character, language, loading, stop, unlockAudioCtx, playTTSWeb, playTTSNative]
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
