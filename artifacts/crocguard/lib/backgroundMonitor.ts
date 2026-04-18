/**
 * CrocGuard Background Monitor
 *
 * Implements background polling using expo-background-fetch + expo-task-manager.
 * On iOS: registered via BackgroundFetch (system-controlled interval, min ~15min).
 * On Android: same mechanism, more reliable scheduling.
 *
 * When the app is in the FOREGROUND the main useCrocGuardStatus hook handles 2s polling.
 * This module fires ONLY in background / lock-screen scenarios.
 *
 * On status escalation (green→orange / green→red / orange→red), a local notification
 * is scheduled immediately so the device buzzes/alerts even when the screen is locked.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import * as TaskManager from "expo-task-manager";
import { Platform, Vibration } from "react-native";

export const CROCGUARD_BG_TASK = "CROCGUARD_STATUS_CHECK";

const STATUS_KEY  = "crocguard_bg_last_status";
const API_URL_KEY = "crocguard_settings";

type TrafficLight = "green" | "orange" | "red";
const RANK: Record<TrafficLight, number> = { green: 0, orange: 1, red: 2 };

const ALERT_CONFIG: Record<TrafficLight, { title: string; body: string; color: string }> = {
  orange: {
    title: "⚠ CrocGuard — Movement Detected",
    body:  "Possible crocodile activity near the boat ramp. Remain alert.",
    color: "#f97316",
  },
  red: {
    title: "🔴 CrocGuard — CROC CONFIRMED",
    body:  "Warning: crocodile detected at boat ramp. Do not enter the water.",
    color: "#ef4444",
  },
  green: { title: "", body: "", color: "" },
};

async function getApiBaseUrl(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(API_URL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { apiBaseUrl?: string };
      if (parsed.apiBaseUrl) return parsed.apiBaseUrl;
    }
  } catch {}
  return "http://localhost:8080";
}

async function sendAlertNotification(status: TrafficLight) {
  const cfg = ALERT_CONFIG[status];
  if (!cfg.title) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: cfg.title,
      body:  cfg.body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      color: cfg.color,
      vibrate: status === "red" ? [0, 400, 200, 400, 200, 400] : [0, 200, 100, 200],
    },
    trigger: null,
  });

  if (status === "red") {
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    if (Platform.OS !== "web") {
      try {
        Speech.speak(cfg.body, { language: "en-AU", rate: 0.9 });
      } catch {}
    }
  } else {
    Vibration.vibrate([0, 200, 100, 200]);
  }
}

// ─── Task definition (must be at module top level) ────────────────────────────
TaskManager.defineTask(CROCGUARD_BG_TASK, async () => {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const res = await fetch(`${apiBaseUrl}/api/crocguard/status`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return BackgroundFetch.BackgroundFetchResult.Failed;

    const json = (await res.json()) as { status: TrafficLight; confidence: number };
    const newStatus: TrafficLight = json.status;
    const prevStatus = ((await AsyncStorage.getItem(STATUS_KEY)) as TrafficLight | null) ?? "green";

    if (RANK[newStatus] > RANK[prevStatus]) {
      await sendAlertNotification(newStatus);
    }

    await AsyncStorage.setItem(STATUS_KEY, newStatus);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Registration helpers ──────────────────────────────────────────────────────

export async function registerBackgroundMonitor() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.requestPermissionsAsync();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:   true,
        shouldPlaySound:   true,
        shouldSetBadge:    false,
        shouldShowBanner:  true,
        shouldShowList:    true,
      }),
    });

    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(CROCGUARD_BG_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(CROCGUARD_BG_TASK, {
        minimumInterval: 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {}
}

export async function unregisterBackgroundMonitor() {
  if (Platform.OS === "web") return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(CROCGUARD_BG_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(CROCGUARD_BG_TASK);
    }
  } catch {}
}
