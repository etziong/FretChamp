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
echo "✓ FretChamp.apk ready on Desktop"

echo ""
echo "→ Building AAB (for Google Play)..."
cd "$DIR/android"
JAVA_HOME="$JAVA_HOME" ANDROID_HOME="$ANDROID_HOME" ./gradlew bundleDebug

AAB="$DIR/android/app/build/outputs/bundle/debug/app-debug.aab"
cp "$AAB" "$DIR/FretChamp.aab"
cp "$AAB" "$HOME/Desktop/FretChamp.aab"
echo "✓ FretChamp.aab ready on Desktop"

echo ""
echo "→ Done! Both files ready:"
echo "   • APK (test on phone): $HOME/Desktop/FretChamp.apk"
echo "   • AAB (Google Play):   $HOME/Desktop/FretChamp.aab"
echo ""
echo "→ How to install APK on your phone:"
echo "   1. Transfer FretChamp.apk to your phone (email / Google Drive / cable)"
echo "   2. On your phone, open the file and allow 'Install from unknown apps'"
echo "   3. That's it! The app will install."
echo ""
echo "→ How to upload AAB to Google Play:"
echo "   1. Go to https://play.google.com/console"
echo "   2. Go to your app → Production / Internal testing"
echo "   3. Upload FretChamp.aab under 'App bundle'"
echo "   4. Fill in the store listing and submit for review"
echo ""
echo "→ To test AAB locally with bundletool:"
echo "   java -jar $DIR/bundletool.jar build-apks --bundle=$AAB --output=$DIR/FretChamp.apks --mode=universal"
echo "   (This converts AAB to a universal APK for local testing)"
