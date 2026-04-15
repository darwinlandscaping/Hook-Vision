import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Speech from "expo-speech";

// iOS voice identifiers — tried in order, first available wins
const IOS_MALE_VOICES = [
  "com.apple.voice.enhanced.en-AU.Lee",   // Australian male (enhanced)
  "com.apple.ttsbundle.Lee-compact",       // Australian male (compact)
  "com.apple.voice.enhanced.en-GB.Daniel",// British male (enhanced) — deep
  "com.apple.ttsbundle.Daniel-compact",   // British male (compact)
  "com.apple.voice.enhanced.en-US.Aaron", // US male (enhanced)
];

export function useVoice() {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (Platform.OS === "web") {
      window.speechSynthesis?.cancel();
      utteranceRef.current = null;
    } else {
      Speech.stop();
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      stop();

      if (Platform.OS === "web") {
        if (!("speechSynthesis" in window)) return;

        setSpeaking(true);

        // Wait for voices to load (Chrome lazy-loads them)
        const getVoices = (): Promise<SpeechSynthesisVoice[]> =>
          new Promise((resolve) => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) return resolve(voices);
            window.speechSynthesis.onvoiceschanged = () =>
              resolve(window.speechSynthesis.getVoices());
          });

        const voices = await getVoices();

        // Prefer deep male voices — ordered from best to acceptable
        const preferred = [
          (v: SpeechSynthesisVoice) =>
            /en.AU/i.test(v.lang) && /male|man|lee|bruce/i.test(v.name),
          (v: SpeechSynthesisVoice) =>
            /en.GB/i.test(v.lang) && /male|man|daniel|george/i.test(v.name),
          (v: SpeechSynthesisVoice) =>
            /en.AU/i.test(v.lang),
          (v: SpeechSynthesisVoice) =>
            /en.GB/i.test(v.lang) && /daniel|george/i.test(v.name),
          (v: SpeechSynthesisVoice) =>
            /en.GB/i.test(v.lang),
          (v: SpeechSynthesisVoice) =>
            /en/i.test(v.lang) && /male|man|aaron|alex|fred/i.test(v.name),
        ];

        let chosen: SpeechSynthesisVoice | undefined;
        for (const test of preferred) {
          chosen = voices.find(test);
          if (chosen) break;
        }

        const utt = new SpeechSynthesisUtterance(text);
        if (chosen) utt.voice = chosen;
        utt.lang = chosen?.lang ?? "en-AU";
        utt.rate = 0.88;
        utt.pitch = 0.72;  // low pitch = deep voice
        utt.volume = 1.0;

        utt.onend = () => {
          setSpeaking(false);
          utteranceRef.current = null;
        };
        utt.onerror = () => {
          setSpeaking(false);
          utteranceRef.current = null;
        };

        utteranceRef.current = utt;
        window.speechSynthesis.speak(utt);
      } else {
        // Native — try iOS male voices in order
        setSpeaking(true);

        const tryVoice = async (voices: string[]): Promise<void> => {
          if (voices.length === 0) {
            // Fallback: default en-AU with low pitch
            Speech.speak(text, {
              language: "en-AU",
              rate: 0.88,
              pitch: 0.75,
              onDone: () => setSpeaking(false),
              onError: () => setSpeaking(false),
              onStopped: () => setSpeaking(false),
            });
            return;
          }
          const [voiceId, ...rest] = voices;
          try {
            await new Promise<void>((resolve, reject) => {
              Speech.speak(text, {
                voice: voiceId,
                rate: 0.88,
                pitch: 0.75,
                onDone: () => { setSpeaking(false); resolve(); },
                onError: () => reject(new Error("voice unavailable")),
                onStopped: () => { setSpeaking(false); resolve(); },
              });
            });
          } catch {
            await tryVoice(rest);
          }
        };

        tryVoice([...IOS_MALE_VOICES]);
      }
    },
    [stop]
  );

  return { speak, stop, speaking };
}
