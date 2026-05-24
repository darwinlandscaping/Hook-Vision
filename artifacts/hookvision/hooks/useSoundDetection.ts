import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export interface SoundAlert {
  detected: boolean;
  species?: string;
  event?: string;
  fishingIndicator?: string;
  behavior?: string;
  direction?: string;
  distance?: string;
  confidence?: number;
  narration?: string;
  plan?: string;
}

interface UseSoundDetectionOptions {
  screenType: "sonar" | "bird";
  context?: { timeOfDay?: string; region?: string };
  apiBase?: string;
  onRecordStart?: () => void;
  onRecordEnd?: () => void;
}

export function useSoundDetection({
  screenType,
  context,
  apiBase = "",
  onRecordStart,
  onRecordEnd,
}: UseSoundDetectionOptions) {
  const [isListening,  setIsListening]  = useState(false);
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [alert,        setAlert]        = useState<SoundAlert | null>(null);
  const recordingRef    = useRef<Audio.Recording | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAlert = useCallback(() => {
    setAlert(null);
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; }
  }, []);

  const analyzeRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) { setIsListening(false); setIsAnalyzing(false); return; }

    setIsListening(false);
    setIsAnalyzing(true);
    onRecordEnd?.();

    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;

      if (!uri) { setIsAnalyzing(false); return; }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as const,
      });
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

      const resp = await fetch(`${apiBase}/api/sound/analyze`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64,
          audioFormat: Platform.OS === "ios" ? "m4a" : "m4a",
          screenType,
          context,
        }),
      });

      if (!resp.ok) { setIsAnalyzing(false); return; }

      const data: SoundAlert = await resp.json();
      if (data.detected && (data.confidence ?? 0) >= 35) {
        setAlert(data);
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => setAlert(null), 12_000);
      }
    } catch {
      // non-fatal
    } finally {
      setIsAnalyzing(false);
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      }).catch(() => {});
    }
  }, [screenType, context, apiBase, onRecordEnd]);

  const startListening = useCallback(async () => {
    if (Platform.OS === "web")    return;
    if (isListening || isAnalyzing) return;

    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS:       true,
        playsInSilentModeIOS:     true,
        staysActiveInBackground:  false,
      });

      onRecordStart?.();

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });

      recordingRef.current = rec;
      await rec.startAsync();
      setIsListening(true);

      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      autoStopRef.current = setTimeout(() => { analyzeRecording(); }, 4_000);
    } catch {
      setIsListening(false);
      onRecordEnd?.();
    }
  }, [isListening, isAnalyzing, onRecordStart, analyzeRecording]);

  const stopListening = useCallback(async () => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    setIsListening(false);
    onRecordEnd?.();
  }, [onRecordEnd]);

  useEffect(() => {
    return () => {
      if (autoStopRef.current)    clearTimeout(autoStopRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  return { isListening, isAnalyzing, alert, startListening, stopListening, clearAlert };
}
