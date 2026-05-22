#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/deskT.png"
RES="$DIR/android/app/src/main/res"
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
ANDROID_HOME="$HOME/Library/Android/sdk"

echo "→ Copying web assets to www..."
cp "$DIR"/*.png "$DIR"/*.js "$DIR"/*.html "$DIR"/*.css "$DIR"/*.json "$DIR/www/" 2>/dev/null || true

echo "→ Updating icons..."
for file in ic_launcher ic_launcher_foreground; do
  sips -z 36  36  "$SRC" --out "$RES/mipmap-ldpi/${file}.png"    > /dev/null
  sips -z 48  48  "$SRC" --out "$RES/mipmap-mdpi/${file}.png"    > /dev/null
  sips -z 72  72  "$SRC" --out "$RES/mipmap-hdpi/${file}.png"    > /dev/null
  sips -z 96  96  "$SRC" --out "$RES/mipmap-xhdpi/${file}.png"   > /dev/null
  sips -z 144 144 "$SRC" --out "$RES/mipmap-xxhdpi/${file}.png"  > /dev/null
  sips -z 192 192 "$SRC" --out "$RES/mipmap-xxxhdpi/${file}.png" > /dev/null
done

echo "→ Syncing web assets..."
cd "$DIR"
npx cap sync android

echo "→ Building APK..."
cd "$DIR/android"
JAVA_HOME="$JAVA_HOME" ANDROID_HOME="$ANDROID_HOME" ./gradlew assembleDebug

APK="$DIR/android/app/build/outputs/apk/debug/app-debug.apk"
cp "$APK" "$DIR/FretChamp.apk"
cp "$APK" "$HOME/Desktop/FretChamp.apk"

echo "✓ Done! FretChamp.apk ready on Desktop and server."
