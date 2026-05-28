#!/bin/bash
export EXPO_TOKEN=$(printenv EXPO_TOKEN)
EAS=/home/runner/workspace/.config/npm/node_global/bin/eas

echo "=== WA ==="
cd /home/runner/workspace/artifacts/hookvision
$EAS update --branch main --message "OTA push" --non-interactive 2>&1
echo "WA DONE"

echo "=== NQ ==="
cd /home/runner/workspace/artifacts/hookvision-nq
$EAS update --branch main --message "OTA push" --non-interactive 2>&1
echo "NQ DONE"

echo "=== NT ==="
cd /home/runner/workspace/artifacts/hookvision-nt
$EAS update --branch main --message "OTA push" --non-interactive 2>&1
echo "NT DONE"

echo "ALL DONE"
