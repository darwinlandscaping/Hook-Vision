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

// expo-audio (replaces deprecated expo-av)
let _createAudioPlayer: any = null;
let _setAudioModeAsync: any = null;
if (Platform.OS !== "web") {
  try {
    const ea = require("expo-audio");
    _createAudioPlayer = ea.createAudioPlayer;
    _setAudioModeAsync = ea.setAudioModeAsync;
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type NarratorCharacter = "AUSSIE" | "BENAUD" | "CHOPPER" | "ATTENBOROUGH" | "WIFE";
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
  { id: "AUSSIE",       name: "Blue the Guide",      emoji: "🎣", tagline: "Sun-leathered NT barra legend", color: "#00d4aa" },
  { id: "BENAUD",       name: "Richie Benaud",        emoji: "🏏", tagline: "Cricket's voice, fishing's poet", color: "#ffd700" },
  { id: "CHOPPER",      name: "Chopper Read",          emoji: "🪖", tagline: "Melbourne's most dangerous narrator", color: "#ff4500" },
  { id: "ATTENBOROUGH", name: "David Attenborough",   emoji: "🌿", tagline: "BBC natural history legend",    color: "#4a9eff" },
  { id: "WIFE",         name: "The Nagging Wife",      emoji: "👩", tagline: "Knows the tides. Not impressed.", color: "#ff69b4" },
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
  transcript: string;
  setCharacter: (c: NarratorCharacter) => void;
  setLanguage: (l: NarratorLanguage) => void;
  speak: (text: string) => void;
  narratePage: (pageType: string, content: string) => Promise<void>;
  stop: () => void;
}

const NarratorContext = createContext<NarratorCtx | null>(null);

// ─── Native Audio (expo-audio, module-level) ──────────────────────────────────
let _nativePlayer: any = null;
let _nativeListener: any = null;

function stopNativeAudio() {
  if (_nativeListener) {
    try { _nativeListener.remove(); } catch {}
    _nativeListener = null;
  }
  if (_nativePlayer) {
    try { _nativePlayer.pause(); _nativePlayer.remove(); } catch {}
    _nativePlayer = null;
  }
}

async function playNativeUrl(url: string, onDone: () => void): Promise<boolean> {
  if (!_createAudioPlayer) return false;
  try {
    stopNativeAudio();
    const player = _createAudioPlayer({ uri: url });
    _nativePlayer = player;
    _nativeListener = player.addListener("playbackStatusUpdate", (status: any) => {
      if (status?.didJustFinish) {
        stopNativeAudio();
        onDone();
      }
    });
    player.play();
    return true;
  } catch (err) {
    console.warn("[Narrator] expo-audio failed:", err);
    stopNativeAudio();
    return false;
  }
}

// ─── Web Audio element (module-level) ─────────────────────────────────────────
let _webAudio: HTMLAudioElement | null = null;

function stopWebAudio() {
  if (_webAudio) {
    try { _webAudio.pause(); _webAudio.src = ""; } catch {}
    _webAudio = null;
  }
}

// ─── Web: unlock speechSynthesis inside user gesture ─────────────────────────
function unlockSpeechSynthesis() {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NarratorProvider({ children }: { children: React.ReactNode }) {
  const [character, setCharacterState] = useState<NarratorCharacter>("AUSSIE");
  const [language, setLanguageState]   = useState<NarratorLanguage>("en-AU");
  const [speaking, setSpeaking]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [transcript, setTranscript]     = useState("");
  const languageRef = useRef(language);

  useEffect(() => { languageRef.current = language; }, [language]);

  // Configure expo-audio session (native only)
  useEffect(() => {
    if (Platform.OS !== "web" && _setAudioModeAsync) {
      _setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        shouldPlayInBackground: false,
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
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      stopNativeAudio();
      Speech.stop().catch(() => {});
    }
    setSpeaking(false);
  }, []);

  // ─── Build TTS URL ─────────────────────────────────────────────────────────
  const ttsUrl = useCallback((text: string) => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    return `${baseUrl}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(languageRef.current)}`;
  }, []);

  // ─── Web: play via HTMLAudioElement → speechSynthesis fallback ────────────
  // NOTE: We use document.createElement("audio") — NOT "new Audio()" which would
  // reference the expo-av Audio class imported at module level.
  const playTTSWeb = useCallback(async (text: string, audioEl: HTMLAudioElement) => {
    setSpeaking(true);
    stopWebAudio();
    _webAudio = audioEl;

    let audioWorked = false;
    try {
      const url = ttsUrl(text);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`TTS HTTP ${resp.status}`);
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      audioEl.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        audioEl.onended = () => { URL.revokeObjectURL(objectUrl); if (_webAudio === audioEl) _webAudio = null; resolve(); };
        audioEl.onerror = () => { URL.revokeObjectURL(objectUrl); if (_webAudio === audioEl) _webAudio = null; reject(new Error("audio element error")); };
        audioEl.play().then(resolve).catch(reject);
      });
      audioWorked = true;
    } catch (err) {
      console.warn("[Narrator] Audio element failed:", err);
      if (_webAudio === audioEl) _webAudio = null;
    }

    if (!audioWorked) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = languageRef.current;
        u.rate = 0.9;
        u.onend  = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
        return;
      }
    }

    setSpeaking(false);
  }, [ttsUrl]);

  // ─── Native: expo-audio → expo-speech fallback ────────────────────────────
  const playTTSNative = useCallback(async (text: string) => {
    setSpeaking(true);

    const worked = await playNativeUrl(ttsUrl(text), () => setSpeaking(false));

    if (!worked) {
      try {
        Speech.speak(text, {
          language: languageRef.current,
          rate: 0.9,
          onDone:  () => setSpeaking(false),
          onError: () => setSpeaking(false),
        });
        return;
      } catch {
        setSpeaking(false);
      }
    }
  }, [ttsUrl]);

  // ─── speak(): direct call (demo button, live camera) ─────────────────────
  const speak = useCallback(
    (text: string) => {
      stop();
      setTranscript(text);
      if (Platform.OS === "web") {
        // CRITICAL: use document.createElement, NOT "new Audio()" which references expo-av
        const audioEl = document.createElement("audio") as HTMLAudioElement;
        playTTSWeb(text, audioEl);
      } else {
        playTTSNative(text);
      }
    },
    [stop, playTTSWeb, playTTSNative]
  );

  // ─── narratePage(): AI narration then speaks ──────────────────────────────
  const narratePage = useCallback(
    async (pageType: string, content: string) => {
      if (loading) return;
      setLoading(true);
      stop();

      // On web: create audio element + unlock speechSynthesis synchronously
      // within the user gesture BEFORE any async work (autoplay policy).
      let audioEl: HTMLAudioElement | null = null;
      if (Platform.OS === "web") {
        // CRITICAL: use document.createElement, NOT "new Audio()" which references expo-av
        audioEl = document.createElement("audio") as HTMLAudioElement;
        unlockSpeechSynthesis();
      }

      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const baseUrl = domain ? `https://${domain}` : "";
        const resp = await fetch(`${baseUrl}/api/narrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, character, language, pageType }),
        });
        if (!resp.ok) throw new Error(`Narrate HTTP ${resp.status}`);
        const { text } = await resp.json();
        if (text) {
          setTranscript(text);
          if (Platform.OS === "web" && audioEl) {
            await playTTSWeb(text, audioEl);
          } else {
            await playTTSNative(text);
          }
        }
      } catch (err) {
        console.warn("[Narrator] narratePage error:", err);
      } finally {
        setLoading(false);
      }
    },
    [character, language, loading, stop, playTTSWeb, playTTSNative]
  );

  return (
    <NarratorContext.Provider
      value={{ character, language, speaking, loading, transcript, setCharacter, setLanguage, speak, narratePage, stop }}
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
