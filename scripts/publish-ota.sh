#!/usr/bin/env bash
set -e

MSG="${1:-AI optimizations + HUD glasses pipeline fixes}"
BRANCH="${2:-preview}"

if [ -z "$EXPO_TOKEN" ]; then
  echo "❌ EXPO_TOKEN not set. Add it in Secrets panel or export it."
  exit 1
fi

APPS=("hookvision" "hookvision-nt" "hookvision-nq")
LABELS=("WA/Kimberley" "Northern Territory" "North Queensland")

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  HookVision OTA Publish → branch: $BRANCH           ║"
echo "║  Message: $MSG                                       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

for i in "${!APPS[@]}"; do
  APP="${APPS[$i]}"
  LABEL="${LABELS[$i]}"
  DIR="/workspace/artifacts/$APP"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📱 Publishing: $LABEL ($APP)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  cd "$DIR"

  CI=1 EXPO_TOKEN="$EXPO_TOKEN" EAS_SKIP_AUTO_FINGERPRINT=1 METRO_MAX_WORKERS=1 \
    eas update --branch "$BRANCH" --platform all --message "$MSG" --non-interactive 2>&1 | tee /tmp/eas-update-$APP.log

  PROJECT_ID=$(grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' app.json | head -1 | grep -o '"[^"]*"$' | tr -d '"')

  if [ -n "$PROJECT_ID" ]; then
    UPDATE_URL="https://expo.dev/projects/$PROJECT_ID/updates"
    EXPO_GO_URL="exp://u.expo.dev/update/$PROJECT_ID"

    echo ""
    echo "✅ $LABEL published!"
    echo ""
    echo "📋 Dashboard: $UPDATE_URL"
    echo ""
    echo "📱 Scan this QR code with your phone camera to open in Expo Go:"
    echo ""
    qrcode-terminal "$UPDATE_URL" --small 2>/dev/null || echo "(QR generation skipped)"
    echo ""
  fi
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ ALL DONE — restart your apps to get the update  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Your phones check for updates on app launch (ON_LOAD)."
echo "Force-close and reopen the app, or shake → 'Check for updates'."
