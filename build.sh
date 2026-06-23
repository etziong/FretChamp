#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/deskT.png"
RES="$DIR/android/app/src/main/res"
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
ANDROID_HOME="$HOME/Library/Android/sdk"
KEYSTORE="$DIR/FretChamp-release.keystore"
KEYSTORE_FILE="$KEYSTORE"

# ── Verify keystore exists ──────────────────────────────────
if [ ! -f "$KEYSTORE" ]; then
  echo "❌ Keystore not found at $KEYSTORE"
  echo "   Create one with:"
  echo "   keytool -genkey -v -keystore FretChamp-release.keystore -alias FretChamp-alias -keyalg RSA -keysize 2048 -validity 10000"
  exit 1
fi

if [ -z "$KEYSTORE_PASSWORD" ] || [ -z "$KEY_PASSWORD" ]; then
  echo "❌ Environment variables KEYSTORE_PASSWORD and KEY_PASSWORD must be set."
  echo "   Add to ~/.zshrc:"
  echo "   export KEYSTORE_PASSWORD=\"your-keystore-password\""
  echo "   export KEY_PASSWORD=\"your-key-password\""
  exit 1
fi

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

# ── APK (signed) ────────────────────────────────────────────
echo "→ Building signed APK..."
cd "$DIR/android"
JAVA_HOME="$JAVA_HOME" ANDROID_HOME="$ANDROID_HOME" \
  KEYSTORE_FILE="$KEYSTORE_FILE" \
  KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD" KEY_PASSWORD="$KEY_PASSWORD" \
  ./gradlew assembleRelease

APK="$DIR/android/app/build/outputs/apk/release/app-release.apk"
cp "$APK" "$DIR/FretChamp.apk"
cp "$APK" "$HOME/Desktop/FretChamp.apk"
echo "✓ Signed FretChamp.apk ready on Desktop"

# ── AAB (signed, for Google Play) ───────────────────────────
echo ""
echo "→ Building signed AAB (for Google Play)..."
cd "$DIR/android"
JAVA_HOME="$JAVA_HOME" ANDROID_HOME="$ANDROID_HOME" \
  KEYSTORE_FILE="$KEYSTORE_FILE" \
  KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD" KEY_PASSWORD="$KEY_PASSWORD" \
  ./gradlew bundleRelease

AAB="$DIR/android/app/build/outputs/bundle/release/app-release.aab"
cp "$AAB" "$DIR/FretChamp.aab"
cp "$AAB" "$HOME/Desktop/FretChamp.aab"
echo "✓ Signed FretChamp.aab ready on Desktop"

# ── Also build universal APK from AAB for local testing ────
echo ""
echo "→ Building universal APK from AAB (for local device testing)..."
java -jar "$DIR/bundletool.jar" build-apks \
  --bundle="$AAB" \
  --output="$DIR/FretChamp.apks" \
  --mode=universal \
  --ks="$KEYSTORE" \
  --ks-pass="pass:$KEYSTORE_PASSWORD" \
  --ks-key-alias="FretChamp-alias" \
  --key-pass="pass:$KEY_PASSWORD"

unzip -o "$DIR/FretChamp.apks" -d "$DIR/tmp_apks" 2>/dev/null
cp "$DIR/tmp_apks/universal.apk" "$DIR/FretChamp.apk"
cp "$DIR/FretChamp.apk" "$HOME/Desktop/FretChamp.apk"
rm -rf "$DIR/tmp_apks" "$DIR/FretChamp.apks"
echo "✓ Universal APK updated on Desktop (signed & ready to install)"

echo ""
echo "→ Done! Signed files ready:"
echo "   • APK (install on phone): $HOME/Desktop/FretChamp.apk"
echo "   • AAB (Google Play):       $HOME/Desktop/FretChamp.aab"
echo ""
echo "→ Install APK on your phone:"
echo "   1. Transfer FretChamp.apk to your phone (email / Google Drive / cable)"
echo "   2. On your phone, open the file and allow 'Install from unknown apps'"
echo "   3. Done!"
echo ""
echo "→ Upload AAB to Google Play:"
echo "   1. Go to https://play.google.com/console"
echo "   2. Go to your app → Production / Internal testing"
echo "   3. Upload FretChamp.aab under 'App bundle'"
echo "   4. Fill in the store listing and submit for review"

# ── Commit and push APK + AAB ───────────────────────────────
echo ""
echo "→ Committing and pushing APK and AAB..."
cd "$DIR"
git add -f FretChamp.apk FretChamp.aab
git commit -m "Build: update FretChamp APK and AAB"
git push
echo "✓ Pushed to remote"
