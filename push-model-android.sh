#!/bin/bash
# Push MedGemma GGUF model files to an Android device/emulator.
#
# The app's LlamaService automatically discovers models in /data/local/tmp/
# and migrates them to the app's private storage on first launch.
# This avoids fragile `run-as` / `cp` commands that fail on many devices.
#
# Works on: physical devices, emulators, all Android versions.
#
# Prerequisites:
#   - Model files in models/ directory
#   - adb on PATH (comes with Android SDK)
#   - Emulator needs ≥12 GB data partition:
#       edit ~/.android/avd/<name>.avd/config.ini → disk.dataPartition.size=12G
#       then: emulator -avd <name> -wipe-data
#
# Usage:
#   ./push-model-android.sh              # auto-detect device
#   ./push-model-android.sh <device-id>  # target specific device
#   ./push-model-android.sh --check      # only check, don't push
#
set -euo pipefail

# ── Auto-detect Android SDK / adb ────────────────────────────────────────
# Searches common locations so the script works even without adb in PATH.
if ! command -v adb &>/dev/null; then
  for SDK_DIR in \
    "${ANDROID_HOME:-}" \
    "${ANDROID_SDK_ROOT:-}" \
    "$HOME/Library/Android/sdk" \
    "$HOME/Android/Sdk" \
    "/usr/local/share/android-sdk" \
    "/opt/android-sdk"; do
    if [[ -x "${SDK_DIR:-}/platform-tools/adb" ]]; then
      export PATH="$PATH:$SDK_DIR/platform-tools"
      break
    fi
  done
fi

DEVICE_FLAG=""
CHECK_ONLY=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
elif [[ -n "${1:-}" ]]; then
  DEVICE_FLAG="-s $1"
fi

MODELS=(
  "models/medgemma-1.5-4b-it-Q3_K_M.gguf"
  "models/mmproj-F16.gguf"
)
DEST_DIR="/data/local/tmp"

# ── Helpers ──────────────────────────────────────────────────────────────

adb_cmd() { adb $DEVICE_FLAG "$@"; }

file_exists_on_device() {
  adb_cmd shell "[ -f '$1' ] && echo EXISTS || echo MISSING" 2>/dev/null | tr -d '\r'
}

file_size_device() {
  adb_cmd shell "wc -c < '$1'" 2>/dev/null | tr -d '\r' | tr -d ' '
}

file_size_local() {
  wc -c < "$1" | tr -d ' '
}

# ── Preflight ────────────────────────────────────────────────────────────

# Verify adb is available
if ! command -v adb &>/dev/null; then
  echo "❌ adb not found. Install Android SDK platform-tools and add to PATH."
  exit 1
fi

# Verify a device is connected
if ! adb_cmd get-state &>/dev/null; then
  echo "❌ No Android device/emulator detected."
  echo "   Start an emulator or connect a device via USB/WiFi."
  exit 1
fi

DEVICE_NAME=$(adb_cmd shell getprop ro.product.model 2>/dev/null | tr -d '\r')
echo "📱 Device: ${DEVICE_NAME:-unknown}"
echo ""

# ── Push each model ─────────────────────────────────────────────────────

PUSHED=0
SKIPPED=0
MISSING_LOCAL=0

for MODEL_SRC in "${MODELS[@]}"; do
  MODEL_NAME=$(basename "$MODEL_SRC")
  DEST_PATH="${DEST_DIR}/${MODEL_NAME}"

  if [[ ! -f "$MODEL_SRC" ]]; then
    echo "⚠️  $MODEL_NAME — not found locally at $MODEL_SRC (skipped)"
    ((MISSING_LOCAL++))
    continue
  fi

  LOCAL_SIZE=$(file_size_local "$MODEL_SRC")
  LOCAL_SIZE_MB=$(( LOCAL_SIZE / 1048576 ))

  # Check if already on device with matching size
  DEVICE_STATUS=$(file_exists_on_device "$DEST_PATH")
  if [[ "$DEVICE_STATUS" == "EXISTS" ]]; then
    DEVICE_SIZE=$(file_size_device "$DEST_PATH")
    if [[ "$DEVICE_SIZE" == "$LOCAL_SIZE" ]]; then
      echo "✅ $MODEL_NAME — already on device (${LOCAL_SIZE_MB} MB), skipping"
      ((SKIPPED++))
      continue
    else
      echo "🔄 $MODEL_NAME — on device but size mismatch (${DEVICE_SIZE} vs ${LOCAL_SIZE}), re-pushing"
    fi
  fi

  if $CHECK_ONLY; then
    echo "❌ $MODEL_NAME — NOT on device (${LOCAL_SIZE_MB} MB)"
    continue
  fi

  echo "📦 Pushing $MODEL_NAME (${LOCAL_SIZE_MB} MB)…"
  adb_cmd push "$MODEL_SRC" "$DEST_PATH"
  adb_cmd shell "chmod 644 '$DEST_PATH'" 2>/dev/null || true

  # Verify
  VERIFY=$(file_exists_on_device "$DEST_PATH")
  if [[ "$VERIFY" == "EXISTS" ]]; then
    echo "✅ $MODEL_NAME pushed successfully"
    ((PUSHED++))
  else
    echo "❌ $MODEL_NAME push FAILED"
    exit 1
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────

echo ""
if $CHECK_ONLY; then
  echo "Check complete. Run without --check to push missing models."
elif [[ $PUSHED -gt 0 ]]; then
  echo "Done! Pushed $PUSHED model(s). The app will find them automatically on next launch."
elif [[ $SKIPPED -gt 0 ]]; then
  echo "All models already on device — nothing to do."
fi
[[ $MISSING_LOCAL -gt 0 ]] && echo "⚠️  $MISSING_LOCAL model file(s) not found locally in models/ directory."
exit 0
