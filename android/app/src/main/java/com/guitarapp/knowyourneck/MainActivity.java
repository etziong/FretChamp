package com.guitarapp.knowyourneck;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int RECORD_AUDIO_REQUEST_CODE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestHomeShortcut();
        requestMicrophonePermission();
    }

    private void requestMicrophonePermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.RECORD_AUDIO },
                RECORD_AUDIO_REQUEST_CODE
            );
        }
    }

    private void requestHomeShortcut() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ShortcutManager shortcutManager = getSystemService(ShortcutManager.class);
            if (shortcutManager != null && shortcutManager.isRequestPinShortcutSupported()) {
                SharedPreferences prefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE);
                if (!prefs.getBoolean("shortcut_requested", false)) {
                    ShortcutInfo shortcut = new ShortcutInfo.Builder(this, "main_shortcut")
                        .setShortLabel("Fretboard")
                        .setLongLabel("FretChamp")
                        .setIcon(Icon.createWithResource(this, R.mipmap.ic_launcher))
                        .setIntent(new Intent(this, MainActivity.class).setAction(Intent.ACTION_VIEW))
                        .build();
                    shortcutManager.requestPinShortcut(shortcut, null);
                    prefs.edit().putBoolean("shortcut_requested", true).apply();
                }
            }
        }
    }
}
