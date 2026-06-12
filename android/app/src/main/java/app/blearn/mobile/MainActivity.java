package app.blearn.mobile;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;

import com.getcapacitor.CapConfig;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

import java.io.File;
import java.lang.reflect.Field;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    private static final String RUNTIME_PREFS = "blearn_runtime";
    private static final String KEY_WEBVIEW_CACHE_RESET = "webview_cache_reset_v2";
    private static final String KEY_LAST_SEEN_VERSION_CODE = "last_seen_version_code";
    private static final String TAG = "BlearnMainActivity";
    private static final long FRESH_INSTALL_TIME_WINDOW_MS = 5_000L;
    private static final String[] LEGACY_WEBVIEW_CACHE_PATHS = new String[] {
        "app_webview/Service Worker",
        "app_webview/Default/Service Worker",
        "app_webview/Code Cache",
        "app_webview/Default/Code Cache",
        "cache/Cache_Data"
    };
    private final OverlayHandoffCoordinator handoffCoordinator = OverlayHandoffCoordinator.getInstance();
    private PendingNativeNavigation bootstrapNavigation;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenTimePlugin.class);
        PendingNativeNavigation pendingBootstrapNavigation = resolveBootstrapNavigation(getIntent());
        bootstrapNavigation = promoteBootstrapNavigationIfNeeded(pendingBootstrapNavigation);
        if (bootstrapNavigation != null) {
            setTheme(R.style.AppTheme_NoActionBarBlockingBootstrap);
        }
        // Pending blocking handoffs should not briefly restore the last in-app page before the
        // requested blocking route takes over.
        super.onCreate(bootstrapNavigation != null ? null : savedInstanceState);
        if (bootstrapNavigation != null) {
            getWindow().setBackgroundDrawableResource(R.drawable.splash);
            View rootView = findViewById(android.R.id.content);
            if (rootView != null) {
                rootView.setBackgroundResource(R.drawable.splash);
            }
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
            }
            overridePendingTransition(0, 0);
        }
        final ExecutorService cacheCleanupExecutor = Executors.newSingleThreadExecutor();
        cacheCleanupExecutor.execute(() -> {
            try {
                maybeScheduleLegacyWebViewCacheCleanup();
            } finally {
                cacheCleanupExecutor.shutdown();
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        PendingNativeNavigation pendingBootstrapNavigation = resolveBootstrapNavigation(intent);
        bootstrapNavigation = promoteBootstrapNavigationIfNeeded(pendingBootstrapNavigation);
    }

    @Override
    protected void load() {
        config = CapConfig.loadDefault(this);
        String blockingRoute = resolveBootstrapRoute();
        if (!TextUtils.isEmpty(blockingRoute)) {
            applyStartPath(config, blockingRoute);
        }

        super.load();
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (
            requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                || requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX
        ) {
            return;
        }

        PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
        if (pluginHandle == null) {
            Log.i(TAG, "SocialLogin plugin handle is null during Google auth result");
            return;
        }

        Plugin plugin = pluginHandle.getInstance();
        if (!(plugin instanceof SocialLoginPlugin)) {
            Log.i(TAG, "SocialLogin plugin instance is unavailable during Google auth result");
            return;
        }

        ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }

    @Override
    public void onResume() {
        super.onResume();
        PendingNativeNavigation pendingNavigation = PendingNavigationStore.peek(this);
        if (pendingNavigation != null) {
            if (!shouldBootstrapFromPendingStore()) {
                Log.d(
                    TAG,
                    getClass().getSimpleName()
                        + " onResume cleared stale pending navigation for "
                        + pendingNavigation.targetType
                        + ":"
                        + pendingNavigation.targetId
                );
                BlockingFlowState.reset(
                    this,
                    pendingNavigation.sessionId,
                    "main_activity_open_cleared_pending_blocking_flow"
                );
                return;
            }
            Log.d(
                TAG,
                getClass().getSimpleName()
                    + " onResume pending navigation for "
                    + pendingNavigation.targetType
                    + ":"
                    + pendingNavigation.targetId
            );
            handoffCoordinator.markAppForegrounded();
            return;
        }
        Log.d(TAG, getClass().getSimpleName() + " onResume without pending navigation");
    }

    protected PendingNativeNavigation resolveBootstrapNavigation(Intent intent) {
        if (!shouldBootstrapFromPendingStore()) {
            return null;
        }

        PendingNativeNavigation navigation = PendingNavigationStore.peek(this);
        return navigation != null && navigation.isValid() ? navigation : null;
    }

    private PendingNativeNavigation promoteBootstrapNavigationIfNeeded(PendingNativeNavigation navigation) {
        if (navigation == null || !navigation.isValid()) {
            return null;
        }
        if (!shouldPromoteBootstrapNavigation()) {
            return navigation;
        }
        return PendingNavigationStore.promoteToActive(
            this,
            navigation,
            "main activity bootstrapped from pending navigation"
        );
    }

    protected boolean shouldPromoteBootstrapNavigation() {
        return true;
    }

    protected boolean shouldBootstrapFromPendingStore() {
        return false;
    }

    private String resolveBootstrapRoute() {
        return bootstrapNavigation != null && bootstrapNavigation.isValid()
            ? bootstrapNavigation.route
            : null;
    }

    private void applyStartPath(CapConfig capConfig, String route) {
        if (capConfig == null || TextUtils.isEmpty(route)) {
            return;
        }

        try {
            Field startPathField = CapConfig.class.getDeclaredField("startPath");
            startPathField.setAccessible(true);
            String normalizedRoute = route.trim();
            String startPath = normalizedRoute.startsWith("#") ? normalizedRoute : "#" + normalizedRoute;
            startPathField.set(capConfig, startPath);
            Log.d(TAG, "bootstrap start path applied: " + startPath);
        } catch (ReflectiveOperationException error) {
            Log.w(TAG, "Unable to apply bootstrap start path", error);
        }
    }

    private void maybeScheduleLegacyWebViewCacheCleanup() {
        SharedPreferences prefs = getSharedPreferences(RUNTIME_PREFS, MODE_PRIVATE);
        long currentVersionCode = resolveAppVersionCode();
        boolean cleanupAlreadyHandled = prefs.getBoolean(KEY_WEBVIEW_CACHE_RESET, false);
        LegacyWebViewCleanupPolicy.Decision cleanupDecision = LegacyWebViewCleanupPolicy.decide(
            cleanupAlreadyHandled,
            hasLegacyWebViewArtifacts(getFilesDir().getParentFile()),
            isFreshInstall()
        );

        if (cleanupDecision == LegacyWebViewCleanupPolicy.Decision.NONE) {
            persistCurrentVersionCode(prefs, currentVersionCode);
            return;
        }

        if (!markLegacyWebViewCleanupHandled(prefs, currentVersionCode)) {
            debug("webview cleanup decision could not be persisted");
            return;
        }

        if (cleanupDecision == LegacyWebViewCleanupPolicy.Decision.MARK_DONE_ONLY) {
            debug("skip legacy webview cleanup");
            return;
        }

        File dataRoot = getFilesDir().getParentFile();
        if (dataRoot == null) {
            debug("skip legacy webview cleanup: missing data root");
            return;
        }

        for (String relativePath : LEGACY_WEBVIEW_CACHE_PATHS) {
            deleteRecursively(new File(dataRoot, relativePath));
        }
        debug("legacy webview cleanup finished");
    }

    private void deleteRecursively(File target) {
        if (target == null || !target.exists()) {
            return;
        }

        File[] children = target.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursively(child);
            }
        }

        if (!target.delete() && isDebugBuild()) {
            Log.d("BlearnMainActivity", "Could not delete " + target.getAbsolutePath());
        }
    }

    private boolean isDebugBuild() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private boolean markLegacyWebViewCleanupHandled(SharedPreferences prefs, long currentVersionCode) {
        SharedPreferences.Editor editor = prefs
            .edit()
            .putBoolean(KEY_WEBVIEW_CACHE_RESET, true);
        if (currentVersionCode > 0L) {
            editor.putLong(KEY_LAST_SEEN_VERSION_CODE, currentVersionCode);
        }
        return editor.commit();
    }

    private void persistCurrentVersionCode(SharedPreferences prefs, long currentVersionCode) {
        if (currentVersionCode <= 0L) {
            return;
        }
        prefs.edit().putLong(KEY_LAST_SEEN_VERSION_CODE, currentVersionCode).apply();
    }

    private boolean hasLegacyWebViewArtifacts(File dataRoot) {
        if (dataRoot == null) {
            return false;
        }
        for (String relativePath : LEGACY_WEBVIEW_CACHE_PATHS) {
            if (new File(dataRoot, relativePath).exists()) {
                return true;
            }
        }
        return false;
    }

    private boolean isFreshInstall() {
        try {
            PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            long firstInstallTime = packageInfo.firstInstallTime;
            long lastUpdateTime = packageInfo.lastUpdateTime;
            return firstInstallTime > 0L
                && lastUpdateTime > 0L
                && Math.abs(lastUpdateTime - firstInstallTime) <= FRESH_INSTALL_TIME_WINDOW_MS;
        } catch (PackageManager.NameNotFoundException error) {
            debug("package info lookup failed", error);
            return true;
        }
    }

    private long resolveAppVersionCode() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();
        } catch (PackageManager.NameNotFoundException error) {
            debug("version code lookup failed", error);
            return 0L;
        }
    }

    private void debug(String message) {
        if (isDebugBuild()) {
            Log.d(TAG, message);
        }
    }

    private void debug(String message, Throwable error) {
        if (isDebugBuild()) {
            Log.d(TAG, message, error);
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
