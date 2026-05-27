#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-${1:-}}"
MODE="${EXPO_DEV_MODE:-auto}"

if [ -z "$PORT" ]; then
  echo "ERROR: PORT is required. Set PORT or pass it as the first argument." >&2
  exit 1
fi

fuser -k "${PORT}/tcp" 2>/dev/null || true
fuser -k "${PORT}/tcp6" 2>/dev/null || true

if [ "$MODE" = "auto" ]; then
  if [ -n "${REPLIT_EXPO_DEV_DOMAIN:-}" ] && [ -n "${REPLIT_DEV_DOMAIN:-}" ]; then
    MODE="replit"
  else
    MODE="tunnel"
  fi
fi

case "$MODE" in
  replit)
    echo "Starting Expo in Replit proxy mode on port $PORT"
    sleep 3
    exec env \
      EXPO_NO_TELEMETRY=1 \
      EXPO_OFFLINE=1 \
      EXPO_PACKAGER_PROXY_URL="http://${REPLIT_EXPO_DEV_DOMAIN}:${PORT}" \
      EXPO_PUBLIC_DOMAIN="${REPLIT_DEV_DOMAIN}" \
      EXPO_PUBLIC_REPL_ID="${REPL_ID:-}" \
      REACT_NATIVE_PACKAGER_HOSTNAME="${REPLIT_EXPO_DEV_DOMAIN}" \
      EXPO_IGNORE_UNSAFE_ORIGIN=1 \
      pnpm exec expo start --localhost --port "$PORT"
    ;;
  tunnel)
    echo "Starting Expo tunnel on port $PORT"
    echo "Scan the QR code from this terminal in Expo Go to load uncommitted changes."
    exec env EXPO_NO_TELEMETRY=1 pnpm exec expo start --tunnel --port "$PORT"
    ;;
  lan)
    echo "Starting Expo LAN mode on port $PORT"
    exec env EXPO_NO_TELEMETRY=1 pnpm exec expo start --lan --port "$PORT"
    ;;
  *)
    echo "ERROR: Unsupported EXPO_DEV_MODE '$MODE'. Use auto, replit, tunnel, or lan." >&2
    exit 1
    ;;
esac
