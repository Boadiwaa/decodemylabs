#!/usr/bin/env bash
# =============================================================================
# TalkingLabs — Model Download Script
# =============================================================================
# Downloads the quantized MedGemma weights needed to run on-device inference.
# Run this once after cloning the repo, before building the app.
#
# Usage:
#   chmod +x scripts/download-models.sh
#   ./scripts/download-models.sh
#
# Requirements:
#   - curl or wget
#   - ~3 GB of free disk space
#   - Hugging Face account with access to google/medgemma-4b-it-gguf
#     (request access at https://huggingface.co/google/medgemma-4b-it-gguf)
#
# After downloading, the model will be at models/ which is gitignored.
# =============================================================================

set -euo pipefail

MODELS_DIR="$(dirname "$0")/../models"
mkdir -p "$MODELS_DIR"

# ---------------------------------------------------------------------------
# Model file definitions
# ---------------------------------------------------------------------------

# Primary model: MedGemma 1.5B instruction-tuned, Q3_K_M quantization (~1.1 GB)
# This is the text inference model used for lab interpretation and extraction.
MODEL_FILE="medgemma-1.5-4b-it-Q3_K_M.gguf"
MODEL_URL="https://huggingface.co/google/medgemma-4b-it-gguf/resolve/main/medgemma-1.5-4b-it-Q3_K_M.gguf"

# Multimodal projection weights (~550 MB)
# Required for vision (image → lab extraction) mode.
MMPROJ_FILE="mmproj-F16.gguf"
MMPROJ_URL="https://huggingface.co/google/medgemma-4b-it-gguf/resolve/main/mmproj-F16.gguf"

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

  if command -v curl &> /dev/null; then
    curl -L --progress-bar \
      -H "Authorization: Bearer ${HF_TOKEN:-}" \
      "$url" -o "$dest"
  elif command -v wget &> /dev/null; then
    wget --progress=bar:force \
      --header="Authorization: Bearer ${HF_TOKEN:-}" \
      "$url" -O "$dest"
  else
    echo "ERROR: Neither curl nor wget found. Please install one and retry."
    exit 1
  fi

  echo ""
  echo "✓ Downloaded $label"
}

# ---------------------------------------------------------------------------
# Hugging Face token check
# ---------------------------------------------------------------------------

if [ -z "${HF_TOKEN:-}" ]; then
  echo ""
  echo "⚠  HF_TOKEN environment variable not set."
  echo ""
  echo "   MedGemma is a gated model. You need to:"
  echo "   1. Create a Hugging Face account at https://huggingface.co"
  echo "   2. Request access at https://huggingface.co/google/medgemma-4b-it-gguf"
  echo "   3. Generate a User Access Token at https://huggingface.co/settings/tokens"
  echo "   4. Export it: export HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx"
  echo "   5. Re-run this script"
  echo ""
  echo "   Alternatively, download the files manually and place them in models/"
  exit 1
fi

# ---------------------------------------------------------------------------
# Run downloads
# ---------------------------------------------------------------------------

echo "==================================================================="
echo "  TalkingLabs — Downloading MedGemma model weights"
echo "==================================================================="

download_file "$MODEL_URL" "$MODELS_DIR/$MODEL_FILE" "MedGemma text model"
download_file "$MMPROJ_URL" "$MODELS_DIR/$MMPROJ_FILE" "Multimodal projection weights"

# ---------------------------------------------------------------------------
# Verify file sizes (rough sanity check)
# ---------------------------------------------------------------------------

MIN_MODEL_SIZE=$((500 * 1024 * 1024))   # 500 MB — model should be at least this
MIN_MMPROJ_SIZE=$((100 * 1024 * 1024))  # 100 MB

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
check_size "$MODELS_DIR/$MODEL_FILE" $MIN_MODEL_SIZE "MedGemma model"
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
