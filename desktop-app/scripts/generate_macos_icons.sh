#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MACOS_ICON_SOURCE_PATH="packaging/macos/icon.icon"
DMG_ICON_IMAGE_NAME="$(node -e 'process.stdout.write(require("./packaging/macos/icon.icon/icon.json").groups[0].layers[0]["image-name"])')"
DMG_ICON_SOURCE_PATH="$MACOS_ICON_SOURCE_PATH/Assets/$DMG_ICON_IMAGE_NAME"
DMG_BACKGROUND_SOURCE_PATH="packaging/macos/assets/dmg-background.svg"
GENERATED_ICON_DIR="packaging/macos/generated-icons"
ICONSET_DIR="$GENERATED_ICON_DIR/icon.iconset"
ASSET_CATALOG_OUTPUT_DIR="$GENERATED_ICON_DIR/asset-catalog-output"

if [[ ! -f "$DMG_ICON_SOURCE_PATH" ]]; then
  echo "Missing macOS DMG icon source at $DMG_ICON_SOURCE_PATH" >&2
  exit 1
fi

if [[ ! -f "$DMG_BACKGROUND_SOURCE_PATH" ]]; then
  echo "Missing macOS DMG background at $DMG_BACKGROUND_SOURCE_PATH" >&2
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is required to generate macOS DMG backgrounds." >&2
  exit 1
fi

if ! command -v iconutil >/dev/null 2>&1; then
  echo "iconutil is required to generate macOS DMG icons." >&2
  exit 1
fi

if ! xcrun --find actool >/dev/null 2>&1; then
  echo "Xcode's actool is required to generate the macOS app icon asset catalog." >&2
  exit 1
fi

rm -rf "$GENERATED_ICON_DIR"
mkdir -p "$GENERATED_ICON_DIR" "$ICONSET_DIR"

# Generate the legacy DMG icon from the checked-in Apple Icon Composer image.
sips -z 16 16 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$DMG_ICON_SOURCE_PATH" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET_DIR" -o "$GENERATED_ICON_DIR/icon.icns"
rm -rf "$ICONSET_DIR"

# Compile the Icon Composer source so macOS 26 can render its white background and native icon shape.
mkdir -p "$ASSET_CATALOG_OUTPUT_DIR"
xcrun actool "$REPO_ROOT/$MACOS_ICON_SOURCE_PATH" \
  --compile "$REPO_ROOT/$ASSET_CATALOG_OUTPUT_DIR" \
  --platform macosx \
  --minimum-deployment-target 12.0 \
  --app-icon icon \
  --standalone-icon-behavior all \
  --output-partial-info-plist "$REPO_ROOT/$ASSET_CATALOG_OUTPUT_DIR/icon-info.plist" \
  --warnings \
  --errors \
  --notices >/dev/null
mv "$ASSET_CATALOG_OUTPUT_DIR/Assets.car" "$GENERATED_ICON_DIR/Assets.car"
rm -rf "$ASSET_CATALOG_OUTPUT_DIR"

sips -s format png "$DMG_BACKGROUND_SOURCE_PATH" --out "$GENERATED_ICON_DIR/dmg-background.png" >/dev/null
sips -s format png -z 760 1080 "$DMG_BACKGROUND_SOURCE_PATH" --out "$GENERATED_ICON_DIR/dmg-background@2x.png" >/dev/null
