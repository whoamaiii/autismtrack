package com.kreativium.neurologg;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins
        registerPlugin(KreativiumPlugin.class);
        registerPlugin(BiometricPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
