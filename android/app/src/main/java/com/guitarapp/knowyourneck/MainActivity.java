package com.guitarapp.knowyourneck;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestHomeShortcut();
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
