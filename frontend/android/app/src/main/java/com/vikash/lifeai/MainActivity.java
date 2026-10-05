package com.vikash.lifeai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HandsFreeVoicePlugin.class);
        registerPlugin(AlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
