package com.chinmaysolanki.heatwise;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends BridgeActivity {
  private static final int REQ_PERMS = 9301;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
      WebView.setWebContentsDebuggingEnabled(true);
    }
    super.onCreate(savedInstanceState);

    requestRuntimePermissionsIfNeeded();

    // Allow WebView getUserMedia() prompts (camera/mic) to work.
    // This keeps the existing HeatWise web app unchanged.
    if (this.bridge != null && this.bridge.getWebView() != null) {
      // Use Capacitor's WebChromeClient so file picker + other features keep working.
      this.bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
        @Override
        public void onPermissionRequest(final PermissionRequest request) {
          runOnUiThread(() -> {
            try {
              request.grant(request.getResources());
            } catch (Exception e) {
              request.deny();
            }
          });
        }
      });
    }
  }

  private void requestRuntimePermissionsIfNeeded() {
    try {
      java.util.ArrayList<String> perms = new java.util.ArrayList<>();

      if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
        perms.add(Manifest.permission.CAMERA);
      }

      // Optional; the web app requests audio=false, but keep it available.
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        perms.add(Manifest.permission.RECORD_AUDIO);
      }

      if (Build.VERSION.SDK_INT >= 33) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
          perms.add(Manifest.permission.READ_MEDIA_IMAGES);
        }
      } else {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
          perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
      }

      if (!perms.isEmpty()) {
        ActivityCompat.requestPermissions(this, perms.toArray(new String[0]), REQ_PERMS);
      }
    } catch (Exception ignored) {
      // Best-effort: permission requests should not crash app startup.
    }
  }
}
