import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useEffect, useRef } from "react";
import { Vibration } from "react-native";
import type { TrafficLight } from "./useCrocGuardStatus";

const BEEP_URL = "https://www.soundjay.com/button/sounds/beep-01a.mp3";
const SIREN_URL = "https://www.soundjay.com/mechanical/sounds/alarm-01a.mp3";

const RED_VOICE = "Warning: crocodile detected at boat ramp. Do not enter the water.";

let soundRef: Audio.Sound | null = null;

async function playSound(url: string, volume = 1.0) {
  try {
    if (soundRef) {
      await soundRef.unloadAsync().catch(() => {});
      soundRef = null;
    }
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, volume }
    );
    soundRef = sound;
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.isLoaded && s.didJustFinish) sound.unloadAsync().catch(() => {});
    });
  } catch {
    // Audio failed — vibration still fires
  }
}

function speakWarning() {
  try {
    Speech.speak(RED_VOICE, {
      language: "en-AU",
      rate: 0.9,
      onError: () => {},
    });
  } catch {
    // TTS not available — vibration still fires
  }
}

export function useAudioAlert(
  currentStatus: TrafficLight | undefined,
  prevStatus: TrafficLight | null,
  audioEnabled: boolean
) {
  const hasAlertedRef = useRef<TrafficLight | null>(null);

  useEffect(() => {
    if (!currentStatus || !audioEnabled) return;
    if (currentStatus === hasAlertedRef.current) return;
    if (prevStatus === null) {
      hasAlertedRef.current = currentStatus;
      return;
    }

    const RANK: Record<TrafficLight, number> = { green: 0, orange: 1, red: 2 };
    const isEscalating = RANK[currentStatus] > RANK[prevStatus ?? "green"];
    if (!isEscalating) {
      hasAlertedRef.current = currentStatus;
      return;
    }

    hasAlertedRef.current = currentStatus;

    if (currentStatus === "orange") {
      Vibration.vibrate([0, 200, 100, 200]);
      playSound(BEEP_URL, 0.6);
    } else if (currentStatus === "red") {
      Vibration.vibrate([0, 400, 200, 400, 200, 400]);
      playSound(SIREN_URL, 1.0);
      // Slight delay so siren starts first, then voice
      setTimeout(speakWarning, 1500);
    }
  }, [currentStatus, prevStatus, audioEnabled]);
}
