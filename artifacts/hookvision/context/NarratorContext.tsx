/**
 * NarratorContext — AI voice narrator for HookVision.
 *
 * Platform strategy:
 *   Web    → Web Speech API (SpeechSynthesis), character-tuned pitch/rate
 *   Native → expo-av Audio.Sound streaming from GET /api/tts URL
 *            fallback: expo-speech (system TTS) with iOS voice selection
 *
 * The GET /api/tts endpoint generates Microsoft Edge TTS (24kHz MP3) and is
 * designed specifically to be streamed directly by expo-av on iOS/Android,
 * removing the need for any local speech engine on native.
 */
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

// expo-av: native audio playback from URL (streams TTS MP3 directly)
let _Audio: any = null;
if (Platform.OS !== "web") {
  try {
    _Audio = require("expo-av").Audio;
  } catch (e) {
    console.warn("[Narrator] expo-av not available:", e);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type NarratorCharacter =
  | "AUSSIE" | "BENAUD" | "CHOPPER" | "ATTENBOROUGH" | "WIFE"
  | "ARNIE" | "BURGUNDY" | "IRWIN" | "GRYLLS" | "RAMSAY"
  | "MORGAN" | "DUNDEE" | "YODA" | "CONNERY" | "BOBROSS"
  | "SPARROW" | "TYSON" | "SAMUEL" | "JEFF" | "BOGAN";
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
  { id: "AUSSIE",       name: "Blue the Guide",      emoji: "🎣", tagline: "Sun-leathered WA barra legend",        color: "#00d4aa" },
  { id: "BENAUD",       name: "Richie Benaud",        emoji: "🏏", tagline: "Cricket's voice, fishing's poet",      color: "#ffd700" },
  { id: "CHOPPER",      name: "Chopper Read",          emoji: "🪖", tagline: "Melbourne's most dangerous narrator", color: "#ff4500" },
  { id: "ATTENBOROUGH", name: "David Attenborough",   emoji: "🌿", tagline: "BBC natural history legend",           color: "#4a9eff" },
  { id: "WIFE",         name: "The Nagging Wife",      emoji: "👩", tagline: "Knows the tides. Not impressed.",     color: "#ff69b4" },
  { id: "ARNIE",        name: "Arnold S.",             emoji: "💪", tagline: "He'll be back — with a big barra",   color: "#e53935" },
  { id: "BURGUNDY",     name: "Ron Burgundy",          emoji: "📺", tagline: "Kind of a big deal on WA waters",    color: "#b8860b" },
  { id: "IRWIN",        name: "Steve Irwin",           emoji: "🐊", tagline: "Crikey! Isn't she a beauty!",        color: "#8bc34a" },
  { id: "GRYLLS",       name: "Bear Grylls",           emoji: "🏕️", tagline: "Every cast is a survival mission",  color: "#795548" },
  { id: "RAMSAY",       name: "Gordon Ramsay",         emoji: "👨‍🍳", tagline: "This fish is RAW. Donkey!",       color: "#f4511e" },
  { id: "MORGAN",       name: "Morgan Freeman",        emoji: "🎬", tagline: "The voice of the Kimberley cosmos",   color: "#7986cb" },
  { id: "DUNDEE",       name: "Crocodile Dundee",      emoji: "🪃", tagline: "That's not a rod. THAT's a rod.",    color: "#ff8f00" },
  { id: "YODA",         name: "Master Yoda",           emoji: "✨", tagline: "Strong with the Force, this barra is", color: "#69f0ae" },
  { id: "CONNERY",      name: "Sean Connery",          emoji: "🍸", tagline: "The name is Barra. Barramundi.",     color: "#90caf9" },
  { id: "BOBROSS",      name: "Bob Ross",              emoji: "🎨", tagline: "Happy little fish, happy little cast", color: "#80cbc4" },
  { id: "SPARROW",      name: "Capt. Jack Sparrow",    emoji: "🏴‍☠️", tagline: "Why is the rum gone? Savvy?",    color: "#a1887f" },
  { id: "TYSON",        name: "Mike Tyson",            emoji: "🥊", tagline: "Everyone has a plan til the fish bites", color: "#f48fb1" },
  { id: "SAMUEL",       name: "Samuel L. Jackson",     emoji: "🎤", tagline: "I have HAD it with these fish",      color: "#ffcc02" },
  { id: "JEFF",         name: "Jeff Goldblum",         emoji: "🦖", tagline: "Life, uh... finds a way to bite",    color: "#ce93d8" },
  { id: "BOGAN",        name: "Aussie Bogan",          emoji: "🍺", tagline: "Fully sick conditions, deadset",      color: "#ff7043" },
];

const CHARACTER_GENDER: Record<NarratorCharacter, "male" | "female"> = {
  AUSSIE: "male", BENAUD: "male", CHOPPER: "male", ATTENBOROUGH: "male",
  WIFE: "female", ARNIE: "male", BURGUNDY: "male", IRWIN: "male",
  GRYLLS: "male", RAMSAY: "male", MORGAN: "male", DUNDEE: "male",
  YODA: "male", CONNERY: "male", BOBROSS: "male", SPARROW: "male",
  TYSON: "male", SAMUEL: "male", JEFF: "male", BOGAN: "male",
};

const CHARACTER_VOICE_TUNING: Record<NarratorCharacter, { pitch: number; rate: number }> = {
  AUSSIE:       { pitch: 0.80, rate: 0.95 },
  BENAUD:       { pitch: 0.70, rate: 0.82 },
  CHOPPER:      { pitch: 0.65, rate: 1.00 },
  ATTENBOROUGH: { pitch: 0.72, rate: 0.78 },
  WIFE:         { pitch: 1.15, rate: 1.05 },
  ARNIE:        { pitch: 0.55, rate: 0.75 },
  BURGUNDY:     { pitch: 0.90, rate: 1.00 },
  IRWIN:        { pitch: 0.88, rate: 1.20 },
  GRYLLS:       { pitch: 0.82, rate: 1.05 },
  RAMSAY:       { pitch: 0.78, rate: 1.15 },
  MORGAN:       { pitch: 0.60, rate: 0.80 },
  DUNDEE:       { pitch: 0.82, rate: 0.90 },
  YODA:         { pitch: 0.68, rate: 0.72 },
  CONNERY:      { pitch: 0.65, rate: 0.88 },
  BOBROSS:      { pitch: 0.76, rate: 0.72 },
  SPARROW:      { pitch: 0.83, rate: 0.93 },
  TYSON:        { pitch: 0.95, rate: 1.08 },
  SAMUEL:       { pitch: 0.70, rate: 1.05 },
  JEFF:         { pitch: 0.88, rate: 0.88 },
  BOGAN:        { pitch: 0.83, rate: 1.22 },
};

const IOS_MALE_VOICES = [
  "com.apple.voice.enhanced.en-AU.Lee",
  "com.apple.ttsbundle.Lee-compact",
  "com.apple.voice.enhanced.en-GB.Daniel",
  "com.apple.ttsbundle.Daniel-compact",
  "com.apple.voice.enhanced.en-US.Aaron",
];
const IOS_FEMALE_VOICES = [
  "com.apple.voice.enhanced.en-AU.Karen",
  "com.apple.ttsbundle.Karen-compact",
  "com.apple.voice.enhanced.en-GB.Kate",
  "com.apple.ttsbundle.Kate-compact",
  "com.apple.voice.enhanced.en-US.Samantha",
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

// ─── Context interface ────────────────────────────────────────────────────────
interface NarratorCtx {
  character: NarratorCharacter;
  language: NarratorLanguage;
  speaking: boolean;
  loading: boolean;
  transcript: string;
  handsFree: boolean;
  setCharacter: (c: NarratorCharacter) => void;
  setLanguage: (l: NarratorLanguage) => void;
  setHandsFree: (on: boolean) => void;
  speak: (text: string) => void;
  autoSpeak: (text: string) => void;
  narratePage: (pageType: string, content: string) => Promise<void>;
  stop: () => void;
}

const NarratorContext = createContext<NarratorCtx | null>(null);

// ─── Native audio (expo-av Audio.Sound) ──────────────────────────────────────
// Module-level so we can stop across renders without stale refs
let _avSound: any = null;

async function stopAvSound(): Promise<void> {
  if (_avSound) {
    try {
      await _avSound.stopAsync();
      await _avSound.unloadAsync();
    } catch {}
    _avSound = null;
  }
}

/**
 * Play TTS audio from URL using expo-av Audio.Sound.
 * Returns true on success, false if expo-av is unavailable.
 */
async function playUrlWithAv(url: string, onDone: () => void): Promise<boolean> {
  if (!_Audio) return false;
  try {
    await stopAvSound();

    // Configure audio session for playback (plays even in silent mode)
    await _Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const { sound } = await _Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, volume: 1.0 }
    );
    _avSound = sound;

    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status?.didJustFinish) {
        stopAvSound().then(onDone);
      }
      if (status?.error) {
        stopAvSound().then(onDone);
      }
    });

    return true;
  } catch (err) {
    console.warn("[Narrator] expo-av playback failed:", err);
    await stopAvSound();
    return false;
  }
}

// ─── Web speech helpers ───────────────────────────────────────────────────────
async function getWebVoice(lang: string, gender: "male" | "female"): Promise<SpeechSynthesisVoice | undefined> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;

  const voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) return resolve(v);
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });

  const base = lang.split("-")[0];

  if (gender === "male") {
    const matchers = [
      (v: SpeechSynthesisVoice) => /en.AU/i.test(v.lang) && /lee|bruce|male|man/i.test(v.name),
      (v: SpeechSynthesisVoice) => /en.GB/i.test(v.lang) && /daniel|george|oliver|male|man/i.test(v.name),
      (v: SpeechSynthesisVoice) => /en.AU/i.test(v.lang) && !/karen|victoria|female|woman/i.test(v.name),
      (v: SpeechSynthesisVoice) => /en/i.test(v.lang) && /aaron|alex|fred|tom|male|man/i.test(v.name),
      (v: SpeechSynthesisVoice) => /en.US/i.test(v.lang) && !/samantha|victoria|female|woman/i.test(v.name),
      (v: SpeechSynthesisVoice) => v.lang.startsWith(base),
    ];
    for (const m of matchers) { const found = voices.find(m); if (found) return found; }
  } else {
    const matchers = [
      (v: SpeechSynthesisVoice) => /en.AU/i.test(v.lang) && /karen|victoria|female|woman/i.test(v.name),
      (v: SpeechSynthesisVoice) => /en.AU/i.test(v.lang),
      (v: SpeechSynthesisVoice) => /en.GB/i.test(v.lang) && /kate|emily|female|woman/i.test(v.name),
      (v: SpeechSynthesisVoice) => /en.GB/i.test(v.lang),
      (v: SpeechSynthesisVoice) => v.lang.startsWith(base),
    ];
    for (const m of matchers) { const found = voices.find(m); if (found) return found; }
  }

  return voices.find(v => v.lang.startsWith(base));
}

let _webUtterance: SpeechSynthesisUtterance | null = null;

function stopWebSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  _webUtterance = null;
}

function unlockSpeechSynthesis() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
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
  const [handsFree, setHandsFreeState]  = useState(false);
  const languageRef  = useRef(language);
  const characterRef = useRef(character);
  const handsFreeRef = useRef(handsFree);

  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { characterRef.current = character; }, [character]);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);

  // Restore saved preferences
  useEffect(() => {
    AsyncStorage.multiGet(["narrator_character", "narrator_language", "narrator_handsfree"]).then(
      (pairs) => {
        const c = pairs[0][1] as NarratorCharacter | null;
        const l = pairs[1][1] as NarratorLanguage | null;
        const hf = pairs[2][1];
        if (c) setCharacterState(c);
        if (l) setLanguageState(l);
        if (hf === "1") setHandsFreeState(true);
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

  const setHandsFree = useCallback((on: boolean) => {
    setHandsFreeState(on);
    AsyncStorage.setItem("narrator_handsfree", on ? "1" : "0");
  }, []);

  // ─── Build TTS URL (GET /api/tts) for expo-av streaming ────────────────────
  const buildTtsUrl = useCallback((text: string, char: NarratorCharacter): string => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const base   = domain ? `https://${domain}` : "";
    return `${base}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(languageRef.current)}&character=${encodeURIComponent(char)}`;
  }, []);

  // ─── Stop all playback ──────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (Platform.OS === "web") {
      stopWebSpeech();
    } else {
      stopAvSound();
      Speech.stop().catch(() => {});
    }
    setSpeaking(false);
  }, []);

  // ─── Web: SpeechSynthesis with character voice tuning ─────────────────────
  const playTTSWeb = useCallback(async (text: string, char: NarratorCharacter) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }

    setSpeaking(true);
    stopWebSpeech();

    const gender = CHARACTER_GENDER[char];
    const tuning = CHARACTER_VOICE_TUNING[char];
    const voice  = await getWebVoice(languageRef.current, gender);

    const utt = new SpeechSynthesisUtterance(text);
    if (voice) { utt.voice = voice; utt.lang = voice.lang; }
    else        { utt.lang = languageRef.current; }
    utt.pitch  = tuning.pitch;
    utt.rate   = tuning.rate;
    utt.volume = 1.0;
    utt.onend   = () => { _webUtterance = null; setSpeaking(false); };
    utt.onerror = () => { _webUtterance = null; setSpeaking(false); };

    _webUtterance = utt;
    window.speechSynthesis.speak(utt);
  }, []);

  // ─── Native: expo-av Audio.Sound → expo-speech fallback ───────────────────
  const playTTSNative = useCallback(async (text: string, char: NarratorCharacter) => {
    setSpeaking(true);

    // Primary path: stream TTS MP3 from GET /api/tts via expo-av Audio.Sound
    const ttsUrl = buildTtsUrl(text, char);
    const avWorked = await playUrlWithAv(ttsUrl, () => setSpeaking(false));

    if (!avWorked) {
      // Fallback: expo-speech (system TTS) with iOS voice selection
      const gender    = CHARACTER_GENDER[char];
      const tuning    = CHARACTER_VOICE_TUNING[char];
      const iosVoices = gender === "male" ? IOS_MALE_VOICES : IOS_FEMALE_VOICES;

      const tryVoice = async (voices: string[]): Promise<void> => {
        if (voices.length === 0) {
          Speech.speak(text, {
            language: languageRef.current,
            rate: tuning.rate,
            pitch: tuning.pitch,
            onDone:  () => setSpeaking(false),
            onError: () => setSpeaking(false),
          });
          return;
        }
        const [voiceId, ...rest] = voices;
        try {
          await new Promise<void>((resolve, reject) => {
            Speech.speak(text, {
              voice: voiceId,
              rate: tuning.rate,
              pitch: tuning.pitch,
              onDone:    () => { setSpeaking(false); resolve(); },
              onError:   () => reject(new Error("voice unavailable")),
              onStopped: () => { setSpeaking(false); resolve(); },
            });
          });
        } catch {
          await tryVoice(rest);
        }
      };

      try { await tryVoice([...iosVoices]); } catch { setSpeaking(false); }
    }
  }, [buildTtsUrl]);

  // ─── speak(): direct TTS call ───────────────────────────────────────────────
  const speak = useCallback(
    (text: string) => {
      stop();
      setTranscript(text);
      const char = characterRef.current;
      if (Platform.OS === "web") {
        playTTSWeb(text, char);
      } else {
        playTTSNative(text, char);
      }
    },
    [stop, playTTSWeb, playTTSNative]
  );

  // ─── autoSpeak(): only fires when hands-free mode is on ────────────────────
  const autoSpeak = useCallback(
    (text: string) => { if (handsFreeRef.current) speak(text); },
    [speak]
  );

  // ─── narratePage(): AI → text → TTS ────────────────────────────────────────
  const narratePage = useCallback(
    async (pageType: string, content: string) => {
      if (loading) return;
      setLoading(true);
      stop();

      if (Platform.OS === "web") unlockSpeechSynthesis();

      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const base   = domain ? `https://${domain}` : "";
        const resp   = await fetch(`${base}/api/narrate`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ content, character, language, pageType }),
        });
        if (!resp.ok) throw new Error(`Narrate HTTP ${resp.status}`);
        const { text } = await resp.json();
        if (text) {
          setTranscript(text);
          if (Platform.OS === "web") {
            await playTTSWeb(text, character);
          } else {
            await playTTSNative(text, character);
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
      value={{ character, language, speaking, loading, transcript, handsFree, setCharacter, setLanguage, setHandsFree, speak, autoSpeak, narratePage, stop }}
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
