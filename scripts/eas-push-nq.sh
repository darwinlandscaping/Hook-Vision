#!/bin/bash
export EXPO_TOKEN=$(printenv EXPO_TOKEN)
EAS=/home/runner/workspace/.config/npm/node_global/bin/eas
cd /home/runner/workspace/artifacts/hookvision-nq
$EAS update --branch preview --message "preview push" --non-interactive 2>&1
echo "NQ DONE"
