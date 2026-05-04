import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useEffect, useRef } from "react";
import { Vibration } from "react-native";

const SIREN_URL = "https://www.soundjay.com/mechanical/sounds/alarm-01a.mp3";
const CROC_WARNING = "Warning: crocodile detected. Stay out of the water.";

let crocSoundRef: Audio.Sound | null = null;

async function playCrocSiren() {
  try {
    if (crocSoundRef) {
      await crocSoundRef.unloadAsync().catch(() => {});
      crocSoundRef = null;
    }
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri: SIREN_URL },
      { shouldPlay: true, volume: 1.0 }
    );
    crocSoundRef = sound;
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.isLoaded && s.didJustFinish) sound.unloadAsync().catch(() => {});
    });
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    setTimeout(() => {
      try { Speech.speak(CROC_WARNING, { language: "en-AU", rate: 0.9, onError: () => {} }); } catch {}
    }, 2000);
  } catch { /* audio unavailable — vibration still fires */ }
}

export function useCrocSound(crocAlertActive: boolean) {
  const prevRef = useRef(false);
  useEffect(() => {
    if (crocAlertActive && !prevRef.current) {
      playCrocSiren();
    }
    prevRef.current = crocAlertActive;
  }, [crocAlertActive]);
}
