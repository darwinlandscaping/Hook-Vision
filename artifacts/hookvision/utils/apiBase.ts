import Constants from "expo-constants";
import { Platform } from "react-native";

function trimSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function getExplicitApiUrl(): string | null {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value) {
    return null;
  }

  return trimSlashes(value);
}

function getExplicitDomainUrl(): string | null {
  const value = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return trimSlashes(value);
  }

  return `https://${value}`;
}

function getWebOrigin(): string | null {
  if (typeof window === "undefined" || !window.location.origin) {
    return null;
  }

  return trimSlashes(window.location.origin);
}

export function getApiBaseUrl(): string | null {
  const explicitApiUrl = getExplicitApiUrl();
  if (explicitApiUrl) {
    return explicitApiUrl;
  }

  if (Platform.OS === "web") {
    return getWebOrigin();
  }

  return getExplicitDomainUrl();
}

export function getApiUrl(path: string): string | null {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function getApiDiagnostics() {
  const baseUrl = getApiBaseUrl();
  const expoGoHost = Constants.expoGoConfig?.debuggerHost?.split(":")[0] ?? null;

  return {
    apiConfigured: Boolean(baseUrl),
    baseUrl,
    expoGoHost,
    isExpoGoDevSession: Platform.OS !== "web" && Boolean(expoGoHost),
  };
}
