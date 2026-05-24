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

export interface SoundDetection extends SoundAlert {
  id: string;
  ts: number;
}

interface UseSoundDetectionOptions {
  screenType: "sonar" | "bird";
  context?: { timeOfDay?: string; region?: string };
  apiBase?: string;
  onDetection?: (d: SoundDetection) => void;
  onRecordStart?: () => void;
  onRecordEnd?: () => void;
}

const RECORD_SECS = 6;

export function useSoundDetection({
  screenType,
  context,
  apiBase = "",
  onDetection,
  onRecordStart,
  onRecordEnd,
}: UseSoundDetectionOptions) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isListening,  setIsListening]  = useState(false);
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [latestAlert,  setLatestAlert]  = useState<SoundAlert | null>(null);
  const [detections,   setDetections]   = useState<SoundDetection[]>([]);

  const activeRef      = useRef(false);
  const recordingRef   = useRef<Audio.Recording | null>(null);
  const dismissRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenTypeRef  = useRef(screenType);
  const contextRef     = useRef(context);
  const apiBaseRef     = useRef(apiBase);
  const onDetectionRef = useRef(onDetection);
  const onRecordStartRef = useRef(onRecordStart);
  const onRecordEndRef   = useRef(onRecordEnd);

  useEffect(() => { screenTypeRef.current  = screenType;  }, [screenType]);
  useEffect(() => { contextRef.current     = context;     }, [context]);
  useEffect(() => { apiBaseRef.current     = apiBase;     }, [apiBase]);
  useEffect(() => { onDetectionRef.current = onDetection; }, [onDetection]);
  useEffect(() => { onRecordStartRef.current = onRecordStart; }, [onRecordStart]);
  useEffect(() => { onRecordEndRef.current   = onRecordEnd;   }, [onRecordEnd]);

  const runCycle = useCallback(async function _cycle() {
    if (!activeRef.current) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:      true,
        playsInSilentModeIOS:    true,
        staysActiveInBackground: false,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      recordingRef.current = rec;
      await rec.startAsync();
      setIsListening(true);
      onRecordStartRef.current?.();
    } catch {
      if (activeRef.current) setTimeout(() => _cycle(), 1500);
      return;
    }

    await new Promise<void>(resolve => setTimeout(resolve, RECORD_SECS * 1000));

    if (!activeRef.current) {
      try { await recordingRef.current?.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
      setIsListening(false);
      return;
    }

    setIsListening(false);
    setIsAnalyzing(true);
    onRecordEndRef.current?.();

    try {
      const rec = recordingRef.current;
      if (rec) {
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        recordingRef.current = null;

        if (uri) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64" as const,
          });
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

          const resp = await fetch(`${apiBaseRef.current}/api/sound/analyze`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64: base64,
              audioFormat: "m4a",
              screenType:  screenTypeRef.current,
              context:     contextRef.current,
            }),
          });

          if (resp.ok) {
            const data: SoundAlert = await resp.json();
            if (data.detected && (data.confidence ?? 0) >= 35) {
              const det: SoundDetection = {
                ...data,
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                ts: Date.now(),
              };
              setLatestAlert(data);
              setDetections(prev => [det, ...prev].slice(0, 20));
              onDetectionRef.current?.(det);

              if (dismissRef.current) clearTimeout(dismissRef.current);
              dismissRef.current = setTimeout(() => setLatestAlert(null), 10_000);
            }
          }
        }
      }
    } catch {
    } finally {
      setIsAnalyzing(false);
      Audio.setAudioModeAsync({
        allowsRecordingIOS:      false,
        playsInSilentModeIOS:    true,
        staysActiveInBackground: false,
      }).catch(() => {});
    }

    if (activeRef.current) void _cycle();
  }, []);

  const startMonitoring = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (activeRef.current) return;
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return;
    activeRef.current = true;
    setIsMonitoring(true);
    setDetections([]);
    setLatestAlert(null);
    void runCycle();
  }, [runCycle]);

  const stopMonitoring = useCallback(async () => {
    activeRef.current = false;
    setIsMonitoring(false);
    setIsListening(false);
    setIsAnalyzing(false);
    if (dismissRef.current) { clearTimeout(dismissRef.current); dismissRef.current = null; }
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    Audio.setAudioModeAsync({
      allowsRecordingIOS:      false,
      playsInSilentModeIOS:    true,
      staysActiveInBackground: false,
    }).catch(() => {});
  }, []);

  const clearAlert      = useCallback(() => setLatestAlert(null), []);
  const clearDetections = useCallback(() => setDetections([]),    []);

  useEffect(() => () => {
    activeRef.current = false;
    if (dismissRef.current) clearTimeout(dismissRef.current);
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
  }, []);

  return {
    isMonitoring,
    isListening,
    isAnalyzing,
    alert:       latestAlert,
    latestAlert,
    detections,
    startMonitoring,
    stopMonitoring,
    startListening: startMonitoring,
    stopListening:  stopMonitoring,
    clearAlert,
    clearDetections,
  };
}
