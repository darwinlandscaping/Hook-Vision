import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useEffect, useRef } from "react";
import { Vibration } from "react-native";
import type { TrafficLight } from "./useCrocGuardStatus";

// Bundled local assets — guaranteed offline reliability at remote boat ramps
const BEEP_LOCAL  = require("../assets/sounds/beep.wav") as number;
const SIREN_LOCAL = require("../assets/sounds/siren.wav") as number;

// Remote fallback (used only if local load fails)
const BEEP_REMOTE  = "https://www.soundjay.com/button/sounds/beep-01a.mp3";
const SIREN_REMOTE = "https://www.soundjay.com/mechanical/sounds/alarm-01a.mp3";

const RED_VOICE = "Warning: crocodile detected at boat ramp. Do not enter the water.";

let soundRef: Audio.Sound | null = null;

async function playSound(local: number, remote: string, volume = 1.0) {
  try {
    if (soundRef) {
      await soundRef.unloadAsync().catch(() => {});
      soundRef = null;
    }
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
    let sound: Audio.Sound;
    try {
      // Try bundled local asset first
      ({ sound } = await Audio.Sound.createAsync(local, { shouldPlay: true, volume }));
    } catch {
      // Fall back to remote URL
      ({ sound } = await Audio.Sound.createAsync({ uri: remote }, { shouldPlay: true, volume }));
    }
    soundRef = sound;
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.isLoaded && s.didJustFinish) sound.unloadAsync().catch(() => {});
    });
  } catch {
    // Audio unavailable — vibration + TTS still fires below
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
      playSound(BEEP_LOCAL, BEEP_REMOTE, 1.0);
    } else if (currentStatus === "red") {
      Vibration.vibrate([0, 400, 200, 400, 200, 400]);
      playSound(SIREN_LOCAL, SIREN_REMOTE, 1.0);
      setTimeout(speakWarning, 1500);
    }
  }, [currentStatus, prevStatus, audioEnabled]);
}

export async function playBeep() {
  Vibration.vibrate([0, 200, 100, 200]);
  await playSound(BEEP_LOCAL, BEEP_REMOTE, 1.0);
}

export async function playSiren() {
  Vibration.vibrate([0, 400, 200, 400, 200, 400]);
  await playSound(SIREN_LOCAL, SIREN_REMOTE, 1.0);
}

export function speakTest() {
  speakWarning();
}
