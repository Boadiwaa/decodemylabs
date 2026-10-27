#!/usr/bin/env bash
# =============================================================================
# TalkingLabs — Model Download Script
# =============================================================================
# Downloads local model assets needed to run on-device inference.
# Run this once after cloning the repo, before building the app.
#
# Usage:
#   chmod +x scripts/download-models.sh
#   ./scripts/download-models.sh
#
# Requirements:
#   - curl or wget
#   - ~6 GB of free disk space for all files
#   - No Hugging Face token: the Gemma 4 repos below are public.
#     HF_TOKEN is sent if set (e.g. to avoid rate limits).
#
# After downloading, the model will be at models/ which is gitignored.
# =============================================================================

set -euo pipefail

MODELS_DIR="$(dirname "$0")/../models"
mkdir -p "$MODELS_DIR"

# ---------------------------------------------------------------------------
# Model file definitions
# ---------------------------------------------------------------------------

# Android runtime (LiteRT-LM): Gemma 4 E2B package (~2.6 GB).
# Set LITERT_MODEL_URL="" to skip it.
LITERT_MODEL_FILE="gemma-4-E2B-it.litertlm"
LITERT_MODEL_URL="${LITERT_MODEL_URL-https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm}"

# iOS runtime (llama.rn): Gemma 4 E2B GGUF, Q4_0 quantization (~2.8 GB).
MODEL_FILE="gemma-4-E2B-it-Q4_0.gguf"
MODEL_URL="https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_0.gguf"

# Vision projector for the GGUF model (~0.56 GB).
# Required for vision (image → lab extraction) mode on llama.rn.
MMPROJ_FILE="mmproj-gemma-4-E2B-it-Q8_0.gguf"
MMPROJ_URL="https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/mmproj-gemma-4-E2B-it-Q8_0.gguf"

# ---------------------------------------------------------------------------
# Download helper
# ---------------------------------------------------------------------------

download_file() {
  local url="$1"
  local dest="$2"
  local label="$3"

  if [ -f "$dest" ]; then
    echo "✓ $label already exists at $dest — skipping."
    return 0
  fi

  echo ""
  echo "⬇  Downloading $label..."
  echo "   URL: $url"
  echo "   Destination: $dest"
  echo ""

  local auth=()
  if command -v curl &> /dev/null; then
    [ -n "${HF_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $HF_TOKEN")
    curl -fL --progress-bar ${auth[@]+"${auth[@]}"} "$url" -o "$dest"
  elif command -v wget &> /dev/null; then
    [ -n "${HF_TOKEN:-}" ] && auth=(--header="Authorization: Bearer $HF_TOKEN")
    wget --progress=bar:force ${auth[@]+"${auth[@]}"} "$url" -O "$dest"
  else
    echo "ERROR: Neither curl nor wget found. Please install one and retry."
    exit 1
  fi

  echo ""
  echo "✓ Downloaded $label"
}

download_if_url_set() {
  local url="$1"
  local dest="$2"
  local label="$3"

  if [ -z "$url" ]; then
    echo ""
    echo "⚠  Skipping $label: no URL configured."
    echo "   Place $dest manually if needed for your runtime."
    return 0
  fi

  download_file "$url" "$dest" "$label"
}

# ---------------------------------------------------------------------------
# Run downloads
# ---------------------------------------------------------------------------

echo "==================================================================="
echo "  TalkingLabs — Downloading local model assets"
echo "==================================================================="

download_if_url_set "$LITERT_MODEL_URL" "$MODELS_DIR/$LITERT_MODEL_FILE" "Gemma-4 LiteRT-LM model"
download_file "$MODEL_URL" "$MODELS_DIR/$MODEL_FILE" "Gemma 4 GGUF model"
download_file "$MMPROJ_URL" "$MODELS_DIR/$MMPROJ_FILE" "Multimodal projection weights"

# ---------------------------------------------------------------------------
# Verify file sizes (rough sanity check)
# ---------------------------------------------------------------------------

MIN_MODEL_SIZE=$((500 * 1024 * 1024))   # 500 MB — model should be at least this
MIN_MMPROJ_SIZE=$((100 * 1024 * 1024))  # 100 MB
MIN_LITERT_SIZE=$((500 * 1024 * 1024))  # 500 MB

check_size() {
  local file="$1"
  local min_size="$2"
  local label="$3"

  if [ -f "$file" ]; then
    local size
    size=$(wc -c < "$file")
    if [ "$size" -lt "$min_size" ]; then
      echo "⚠  WARNING: $label looks too small ($size bytes). The download may be incomplete."
    else
      echo "✓ $label size OK ($(( size / 1024 / 1024 )) MB)"
    fi
  fi
}

echo ""
echo "--- Verifying downloads ---"
check_size "$MODELS_DIR/$LITERT_MODEL_FILE" $MIN_LITERT_SIZE "Gemma-4 LiteRT-LM model"
check_size "$MODELS_DIR/$MODEL_FILE" $MIN_MODEL_SIZE "Gemma 4 GGUF model"
check_size "$MODELS_DIR/$MMPROJ_FILE" $MIN_MMPROJ_SIZE "Multimodal projection"

echo ""
echo "==================================================================="
echo "  Done! Model files are ready in models/"
echo ""
echo "  Next steps:"
echo "  • iOS:     npx expo run:ios"
echo "  • Android: npm run android"
echo "  • See SETUP.md for full instructions"
echo "==================================================================="
