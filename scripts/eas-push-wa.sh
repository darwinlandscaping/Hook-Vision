#!/bin/bash
set -e
export EXPO_TOKEN=$(printenv EXPO_TOKEN)
EAS=/home/runner/workspace/.config/npm/node_global/bin/eas

echo "=== Pushing WA (Kimberley) to preview ==="
cd /home/runner/workspace/artifacts/hookvision
$EAS update --branch preview --message "fix: point to deployed API hook-vision.replit.app" --non-interactive
echo "=== WA DONE ==="

echo "=== Pushing NQ to preview ==="
cd /home/runner/workspace/artifacts/hookvision-nq
$EAS update --branch preview --message "fix: point to deployed API hook-vision.replit.app" --non-interactive
echo "=== NQ DONE ==="

echo "=== Pushing NT to preview ==="
cd /home/runner/workspace/artifacts/hookvision-nt
$EAS update --branch preview --message "fix: point to deployed API hook-vision.replit.app" --non-interactive
echo "=== NT DONE ==="

echo ""
echo "All 3 apps pushed successfully!"
