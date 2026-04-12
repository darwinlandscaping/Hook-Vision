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
  { id: "AUSSIE",       name: "Blue the Guide",      emoji: "🎣", tagline: "Sun-leathered NT barra legend",        color: "#00d4aa" },
  { id: "BENAUD",       name: "Richie Benaud",        emoji: "🏏", tagline: "Cricket's voice, fishing's poet",      color: "#ffd700" },
  { id: "CHOPPER",      name: "Chopper Read",          emoji: "🪖", tagline: "Melbourne's most dangerous narrator", color: "#ff4500" },
  { id: "ATTENBOROUGH", name: "David Attenborough",   emoji: "🌿", tagline: "BBC natural history legend",           color: "#4a9eff" },
  { id: "WIFE",         name: "The Nagging Wife",      emoji: "👩", tagline: "Knows the tides. Not impressed.",     color: "#ff69b4" },
  { id: "ARNIE",        name: "Arnold S.",             emoji: "💪", tagline: "He'll be back — with a big barra",   color: "#e53935" },
  { id: "BURGUNDY",     name: "Ron Burgundy",          emoji: "📺", tagline: "Kind of a big deal on NT waters",    color: "#b8860b" },
  { id: "IRWIN",        name: "Steve Irwin",           emoji: "🐊", tagline: "Crikey! Isn't she a beauty!",        color: "#8bc34a" },
  { id: "GRYLLS",       name: "Bear Grylls",           emoji: "🏕️", tagline: "Every cast is a survival mission",  color: "#795548" },
  { id: "RAMSAY",       name: "Gordon Ramsay",         emoji: "👨‍🍳", tagline: "This fish is RAW. Donkey!",       color: "#f4511e" },
  { id: "MORGAN",       name: "Morgan Freeman",        emoji: "🎬", tagline: "The voice of the NT cosmos",         color: "#7986cb" },
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

// Which characters use a male voice
const CHARACTER_GENDER: Record<NarratorCharacter, "male" | "female"> = {
  AUSSIE:       "male",
  BENAUD:       "male",
  CHOPPER:      "male",
  ATTENBOROUGH: "male",
  WIFE:         "female",
  ARNIE:        "male",
  BURGUNDY:     "male",
  IRWIN:        "male",
  GRYLLS:       "male",
  RAMSAY:       "male",
  MORGAN:       "male",
  DUNDEE:       "male",
  YODA:         "male",
  CONNERY:      "male",
  BOBROSS:      "male",
  SPARROW:      "male",
  TYSON:        "male",
  SAMUEL:       "male",
  JEFF:         "male",
  BOGAN:        "male",
};

// Voice tuning per character (pitch & rate)
const CHARACTER_VOICE_TUNING: Record<NarratorCharacter, { pitch: number; rate: number }> = {
  AUSSIE:       { pitch: 0.80, rate: 0.95 },  // laconic, relaxed
  BENAUD:       { pitch: 0.70, rate: 0.82 },  // measured, authoritative, slow
  CHOPPER:      { pitch: 0.65, rate: 1.00 },  // gravelly, direct
  ATTENBOROUGH: { pitch: 0.72, rate: 0.78 },  // reverent, slow, deep
  WIFE:         { pitch: 1.15, rate: 1.05 },  // energetic, slightly higher
  ARNIE:        { pitch: 0.55, rate: 0.75 },  // very deep Austrian, deliberate
  BURGUNDY:     { pitch: 0.90, rate: 1.00 },  // pompous anchor voice
  IRWIN:        { pitch: 0.88, rate: 1.20 },  // enthusiastic, fast Aussie
  GRYLLS:       { pitch: 0.82, rate: 1.05 },  // earnest, breathless
  RAMSAY:       { pitch: 0.78, rate: 1.15 },  // aggressive, rapid-fire UK
  MORGAN:       { pitch: 0.60, rate: 0.80 },  // very deep, slow, profound
  DUNDEE:       { pitch: 0.82, rate: 0.90 },  // laid-back Australian
  YODA:         { pitch: 0.68, rate: 0.72 },  // deep, very slow
  CONNERY:      { pitch: 0.65, rate: 0.88 },  // deep Scottish
  BOBROSS:      { pitch: 0.76, rate: 0.72 },  // gentle, soothing, very slow
  SPARROW:      { pitch: 0.83, rate: 0.93 },  // slightly irregular
  TYSON:        { pitch: 0.95, rate: 1.08 },  // surprisingly high-ish
  SAMUEL:       { pitch: 0.70, rate: 1.05 },  // emphatic, intense
  JEFF:         { pitch: 0.88, rate: 0.88 },  // measured, contemplative
  BOGAN:        { pitch: 0.83, rate: 1.22 },  // enthusiastic, fast Aussie
};

// iOS male/female voice IDs tried in order
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

// ─── Web: pick a voice matching gender + language ─────────────────────────────
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

// ─── Web: play via speechSynthesis with gender + character tuning ─────────────
let _webUtterance: SpeechSynthesisUtterance | null = null;

function stopWebSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  _webUtterance = null;
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
  const languageRef   = useRef(language);
  const characterRef  = useRef(character);

  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { characterRef.current = character; }, [character]);

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
      stopWebSpeech();
    } else {
      stopNativeAudio();
      Speech.stop().catch(() => {});
    }
    setSpeaking(false);
  }, []);

  // ─── Build TTS URL (native only) ───────────────────────────────────────────
  const ttsUrl = useCallback((text: string) => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    return `${baseUrl}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(languageRef.current)}`;
  }, []);

  // ─── Web: speechSynthesis with character-matched voice + tuning ───────────
  const playTTSWeb = useCallback(async (text: string, char: NarratorCharacter) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }

    setSpeaking(true);
    stopWebSpeech();

    const gender = CHARACTER_GENDER[char];
    const tuning = CHARACTER_VOICE_TUNING[char];

    const voice = await getWebVoice(languageRef.current, gender);

    const utt = new SpeechSynthesisUtterance(text);
    if (voice) {
      utt.voice = voice;
      utt.lang  = voice.lang;
    } else {
      utt.lang = languageRef.current;
    }
    utt.pitch  = tuning.pitch;
    utt.rate   = tuning.rate;
    utt.volume = 1.0;

    utt.onend  = () => { _webUtterance = null; setSpeaking(false); };
    utt.onerror = () => { _webUtterance = null; setSpeaking(false); };

    _webUtterance = utt;
    window.speechSynthesis.speak(utt);
  }, []);

  // ─── Native: expo-audio (TTS URL) → expo-speech fallback ─────────────────
  const playTTSNative = useCallback(async (text: string, char: NarratorCharacter) => {
    setSpeaking(true);

    const worked = await playNativeUrl(ttsUrl(text), () => setSpeaking(false));

    if (!worked) {
      const gender  = CHARACTER_GENDER[char];
      const tuning  = CHARACTER_VOICE_TUNING[char];
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
              onDone:   () => { setSpeaking(false); resolve(); },
              onError:  () => reject(new Error("voice unavailable")),
              onStopped: () => { setSpeaking(false); resolve(); },
            });
          });
        } catch {
          await tryVoice(rest);
        }
      };

      try { await tryVoice([...iosVoices]); } catch { setSpeaking(false); }
    }
  }, [ttsUrl]);

  // ─── speak(): direct call (demo button, live camera) ─────────────────────
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

  // ─── narratePage(): AI narration then speaks ──────────────────────────────
  const narratePage = useCallback(
    async (pageType: string, content: string) => {
      if (loading) return;
      setLoading(true);
      stop();

      // Unlock speechSynthesis inside the user gesture before any async work
      if (Platform.OS === "web") {
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
