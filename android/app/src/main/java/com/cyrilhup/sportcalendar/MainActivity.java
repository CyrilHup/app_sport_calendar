package com.cyrilhup.sportcalendar;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWebViewStorage();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebViewStorage();
    }

    @Override
    public void onPause() {
        super.onPause();
        try {
            CookieManager.getInstance().flush();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void configureWebViewStorage() {
        try {
            if (getBridge() != null) {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    WebSettings settings = webView.getSettings();
                    settings.setDomStorageEnabled(true);
                    settings.setDatabaseEnabled(true);
                    settings.setCacheMode(WebSettings.LOAD_DEFAULT);

                    // Sanitize User-Agent to prevent Google 403 disallowed_useragent
                    String ua = settings.getUserAgentString();
                    if (ua != null) {
                        String cleanUa = ua.replace("; wv", "").replaceAll("Version/[0-9.]+\\s*", "");
                        settings.setUserAgentString(cleanUa);
                    }

                    CookieManager cookieManager = CookieManager.getInstance();
                    cookieManager.setAcceptCookie(true);
                    cookieManager.setAcceptThirdPartyCookies(webView, true);
                    cookieManager.flush();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
