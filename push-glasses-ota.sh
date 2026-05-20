#!/usr/bin/env bash
set -e
MSG="HUD glasses mode: cast arrow, voice narration, croc overlay"

echo "=== WA iOS ==="
cd /home/runner/workspace/artifacts/hookvision
CI=1 EXPO_TOKEN=$EXPO_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 EAS_NO_VCS=1 METRO_MAX_WORKERS=1 \
  eas update --branch preview --platform ios --message "$MSG" --non-interactive

echo "=== WA Android ==="
CI=1 EXPO_TOKEN=$EXPO_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 EAS_NO_VCS=1 METRO_MAX_WORKERS=1 \
  eas update --branch preview --platform android --message "$MSG" --non-interactive

echo "=== NQ iOS ==="
cd /home/runner/workspace/artifacts/hookvision-nq
CI=1 EXPO_TOKEN=$EXPO_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 EAS_NO_VCS=1 METRO_MAX_WORKERS=1 \
  eas update --branch preview --platform ios --message "$MSG" --non-interactive

echo "=== NQ Android ==="
CI=1 EXPO_TOKEN=$EXPO_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 EAS_NO_VCS=1 METRO_MAX_WORKERS=1 \
  eas update --branch preview --platform android --message "$MSG" --non-interactive

echo "=== NT iOS ==="
cd /home/runner/workspace/artifacts/hookvision-nt
CI=1 EXPO_TOKEN=$EXPO_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 EAS_NO_VCS=1 METRO_MAX_WORKERS=1 \
  eas update --branch preview --platform ios --message "$MSG" --non-interactive

echo "=== NT Android ==="
CI=1 EXPO_TOKEN=$EXPO_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 EAS_NO_VCS=1 METRO_MAX_WORKERS=1 \
  eas update --branch preview --platform android --message "$MSG" --non-interactive

echo "=== ALL DONE ==="
