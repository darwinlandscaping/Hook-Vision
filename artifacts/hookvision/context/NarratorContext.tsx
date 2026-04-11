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
  transcript: string;
  setCharacter: (c: NarratorCharacter) => void;
  setLanguage: (l: NarratorLanguage) => void;
  speak: (text: string) => void;
  narratePage: (pageType: string, content: string) => Promise<void>;
  stop: () => void;
}

const NarratorContext = createContext<NarratorCtx | null>(null);

// ─── Native Audio (expo-av, module-level) ─────────────────────────────────────
let _nativeSound: Audio.Sound | null = null;

async function stopNativeAudio() {
  if (_nativeSound) {
    try { await _nativeSound.stopAsync(); await _nativeSound.unloadAsync(); } catch {}
    _nativeSound = null;
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

  // Configure expo-av audio session (native only)
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
      // Fallback: window.speechSynthesis
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = languageRef.current;
        u.rate = 0.9;
        u.onend  = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
        return; // setSpeaking(false) handled by onend
      }
    }

    setSpeaking(false);
  }, [ttsUrl]);

  // ─── Native: expo-av → expo-speech fallback ───────────────────────────────
  const playTTSNative = useCallback(async (text: string) => {
    setSpeaking(true);
    await stopNativeAudio();

    let avWorked = false;
    try {
      const url = ttsUrl(text);
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false, volume: 1.0 }
      );
      _nativeSound = sound;
      await sound.playAsync();
      avWorked = true;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setSpeaking(false);
          sound.unloadAsync().catch(() => {});
          if (_nativeSound === sound) _nativeSound = null;
        }
      });
    } catch (err) {
      console.warn("[Narrator] expo-av failed, falling back to expo-speech:", err);
      if (_nativeSound) {
        try { await _nativeSound.unloadAsync(); } catch {}
        _nativeSound = null;
      }
    }

    if (!avWorked) {
      // Fallback: expo-speech
      try {
        Speech.speak(text, {
          language: languageRef.current,
          rate: 0.9,
          onDone:  () => setSpeaking(false),
          onError: () => setSpeaking(false),
        });
        return; // setSpeaking(false) via onDone
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
        const audioEl = new Audio();
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

      // On web: create Audio element + unlock speechSynthesis synchronously
      // within the user gesture BEFORE any async work, so autoplay policy allows it.
      let audioEl: HTMLAudioElement | null = null;
      if (Platform.OS === "web") {
        audioEl = new Audio();
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
