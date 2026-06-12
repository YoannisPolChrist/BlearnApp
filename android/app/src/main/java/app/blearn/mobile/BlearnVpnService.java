package app.blearn.mobile;

import android.app.PendingIntent;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.os.PowerManager;
import android.text.TextUtils;
import android.util.Log;

import androidx.core.content.ContextCompat;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public class BlearnVpnService extends VpnService {
    private static final String TAG = "BlearnVpnService";
    private static final String ACTION_START = "app.blearn.mobile.action.START_WEBSITE_BLOCKING";
    private static final String ACTION_STOP = "app.blearn.mobile.action.STOP_WEBSITE_BLOCKING";
    private static final String ACTION_UPDATE = "app.blearn.mobile.action.UPDATE_WEBSITE_BLOCKING";
    private static final String PRIMARY_DNS_SERVER = "1.1.1.1";
    private static final String SECONDARY_DNS_SERVER = "1.0.0.1";
    private static final long OVERLAY_COOLDOWN_MS = 1_800L;
    private static final int VPN_MTU = 1_500;
    private static final int DNS_FORWARDER_THREADS = 4;
    private static final int DNS_FORWARDER_QUEUE_CAPACITY = 64;
    private static final int DNS_FORWARD_TIMEOUT_MS = 2_500;

    private final Object stateLock = new Object();
    private final Object tunnelWriteLock = new Object();
    private final OverlayHandoffCoordinator handoffCoordinator = OverlayHandoffCoordinator.getInstance();

    private ParcelFileDescriptor vpnInterface;
    private Thread packetLoopThread;
    private volatile boolean running;
    private volatile DnsDecisionEngine decisionEngine = DnsDecisionEngine.empty();
    private VpnPolicyBridge policyBridge;
    private VpnNotificationController notificationController;
    private ThreadPoolExecutor dnsForwardExecutor;
    private String lastTriggeredTarget = "";
    private long lastTriggeredAt = 0L;
    private boolean foregroundNotificationVisible;

    static Intent createStartIntent(Context context) {
        Intent intent = new Intent(context, BlearnVpnService.class);
        intent.setAction(ACTION_START);
        return intent;
    }

    static Intent createStopIntent(Context context) {
        Intent intent = new Intent(context, BlearnVpnService.class);
        intent.setAction(ACTION_STOP);
        return intent;
    }

    static Intent createUpdateIntent(Context context) {
        Intent intent = new Intent(context, BlearnVpnService.class);
        intent.setAction(ACTION_UPDATE);
        return intent;
    }

    static void start(Context context) {
        ContextCompat.startForegroundService(context, createStartIntent(context));
    }

    static void stop(Context context) {
        context.startService(createStopIntent(context));
    }

    static void update(Context context) {
        context.startService(createUpdateIntent(context));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        policyBridge = new VpnPolicyBridge(this);
        notificationController = new VpnNotificationController(this);
        ensureDnsForwardExecutor();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            debug("stop requested");
            shutdownVpn("stop requested", true);
            return START_NOT_STICKY;
        }

        ensureForegroundNotification();
        refreshDecisionEngine();
        if (!decisionEngine.hasRules()) {
            debug("skip: no website rules configured");
            shutdownVpn("no website rules", true);
            return START_NOT_STICKY;
        }

        if (vpnInterface == null) {
            try {
                startVpnInterface();
            } catch (Exception error) {
                debug("vpn start failed", error);
                shutdownVpn("start failure", true);
                return START_NOT_STICKY;
            }
        } else if (ACTION_UPDATE.equals(action)) {
            debug("vpn policy updated");
            ensureForegroundNotification();
        }

        return START_STICKY;
    }

    @Override
    public void onRevoke() {
        debug("vpn permission revoked");
        shutdownVpn("permission revoked", false);
        stopSelf();
        super.onRevoke();
    }

    @Override
    public void onDestroy() {
        shutdownVpn("service destroyed", false);
        super.onDestroy();
    }

    private void startVpnInterface() throws Exception {
        Builder builder = new Builder()
            .setSession("Blearn Webschutz")
            .setConfigureIntent(buildConfigureIntent())
            .setMtu(VPN_MTU)
            .addAddress("10.7.0.2", 32)
            .addDnsServer(PRIMARY_DNS_SERVER)
            .addDnsServer(SECONDARY_DNS_SERVER)
            .addRoute(PRIMARY_DNS_SERVER, 32)
            .addRoute(SECONDARY_DNS_SERVER, 32);

        try {
            builder.addDisallowedApplication(getPackageName());
        } catch (Exception ignored) {
            // The self-app exclusion is useful, but optional.
        }

        vpnInterface = builder.establish();
        if (vpnInterface == null) {
            throw new IllegalStateException("VPN interface could not be established");
        }

        ensureDnsForwardExecutor();
        ensureForegroundNotification();

        running = true;
        policyBridge.setVpnActive(true);
        packetLoopThread = new Thread(this::runPacketLoop, "blearn-vpn-loop");
        packetLoopThread.start();
        debug("vpn started");
    }

    private PendingIntent buildConfigureIntent() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void runPacketLoop() {
        ParcelFileDescriptor localInterface = vpnInterface;
        if (localInterface == null) {
            debug("skip: packet loop without vpn interface");
            return;
        }

        byte[] packetBuffer = new byte[32_767];

        try (
            FileInputStream inputStream = new FileInputStream(localInterface.getFileDescriptor());
            FileOutputStream outputStream = new FileOutputStream(localInterface.getFileDescriptor())
        ) {
            while (running) {
                int length = inputStream.read(packetBuffer);
                if (length <= 0) {
                    continue;
                }

                DnsPacketCodec.DnsQuery query = DnsPacketCodec.parseDnsQuery(packetBuffer, length);
                if (query == null) {
                    debug("skip: non-dns or unsupported packet");
                    continue;
                }

                DnsDecisionEngine.Decision decision = decisionEngine.decide(query.questionName);
                if (decision.blocked) {
                    byte[] blockedDnsResponse = DnsPacketCodec.buildBlockedDnsResponse(query);
                    writeTunnelPacket(outputStream, DnsPacketCodec.buildUdpResponse(query, blockedDnsResponse));
                    maybeOpenIntervention(decision);
                    continue;
                }

                submitAllowedQuery(outputStream, query);
            }
        } catch (Exception error) {
            if (running) {
                debug("vpn packet loop failed", error);
            }
        } finally {
            shutdownVpn("packet loop finished", false);
        }
    }

    private void submitAllowedQuery(FileOutputStream outputStream, DnsPacketCodec.DnsQuery query) {
        ThreadPoolExecutor executor = dnsForwardExecutor;
        if (executor == null || executor.isShutdown()) {
            writeServfailResponse(outputStream, query, "dns forwarder unavailable");
            return;
        }

        try {
            executor.execute(() -> forwardAllowedQuery(outputStream, query));
        } catch (RejectedExecutionException rejectedError) {
            writeServfailResponse(outputStream, query, "dns forward queue saturated");
        }
    }

    private void forwardAllowedQuery(FileOutputStream outputStream, DnsPacketCodec.DnsQuery query) {
        try {
            if (!running) {
                return;
            }

            byte[] allowedDnsResponse = forwardQuery(query);
            if (allowedDnsResponse != null) {
                writeTunnelPacket(outputStream, DnsPacketCodec.buildUdpResponse(query, allowedDnsResponse));
            }
        } catch (Exception error) {
            debug("dns tunnel write failed for " + query.questionName, error);
        }
    }

    private byte[] forwardQuery(DnsPacketCodec.DnsQuery query) {
        try (DatagramSocket upstreamSocket = new DatagramSocket()) {
            protect(upstreamSocket);
            upstreamSocket.setSoTimeout(DNS_FORWARD_TIMEOUT_MS);
            InetAddress upstreamAddress = InetAddress.getByAddress(query.destinationAddress);
            DatagramPacket outboundPacket = new DatagramPacket(
                query.dnsPayload,
                query.dnsPayload.length,
                upstreamAddress,
                query.destinationPort
            );
            upstreamSocket.send(outboundPacket);

            byte[] responseBuffer = new byte[4_096];
            DatagramPacket inboundPacket = new DatagramPacket(responseBuffer, responseBuffer.length);
            upstreamSocket.receive(inboundPacket);
            return java.util.Arrays.copyOf(inboundPacket.getData(), inboundPacket.getLength());
        } catch (SocketTimeoutException timeoutError) {
            debug("dns forward timeout for " + query.questionName);
            return DnsPacketCodec.buildServfailDnsResponse(query);
        } catch (Exception error) {
            debug("dns forward failed for " + query.questionName, error);
            return DnsPacketCodec.buildServfailDnsResponse(query);
        }
    }

    private void writeServfailResponse(FileOutputStream outputStream, DnsPacketCodec.DnsQuery query, String reason) {
        debug(reason + " for " + query.questionName);
        writeTunnelPacket(
            outputStream,
            DnsPacketCodec.buildUdpResponse(query, DnsPacketCodec.buildServfailDnsResponse(query))
        );
    }

    private void writeTunnelPacket(FileOutputStream outputStream, byte[] packet) {
        synchronized (tunnelWriteLock) {
            if (!running) {
                return;
            }
            try {
                outputStream.write(packet);
            } catch (Exception error) {
                if (running) {
                    debug("tunnel write failed", error);
                }
            }
        }
    }

    private void maybeOpenIntervention(DnsDecisionEngine.Decision decision) {
        PolicyTarget target = decision.target;
        if (target == null || !shouldSurfaceIntervention(target)) {
            return;
        }

        if (handoffCoordinator.shouldSuppressNewTriggers()) {
            debug("skip: handoff_in_progress");
            return;
        }

        String targetKey = target.type + ":" + target.id;
        long now = System.currentTimeMillis();
        if (TextUtils.equals(lastTriggeredTarget, targetKey) && now - lastTriggeredAt < OVERLAY_COOLDOWN_MS) {
            debug("skip: vpn cooldown active for " + targetKey);
            return;
        }

        lastTriggeredTarget = targetKey;
        lastTriggeredAt = now;
        policyBridge.recordTrigger(target.id, target.type);
        String sessionId = UUID.randomUUID().toString();
        PendingNavigationLauncher.open(
            this,
            new PendingNativeNavigation(
                InterventionRouteBuilder.buildBlockingRoute(target, decision.hostname, sessionId),
                target.id,
                target.type,
                target.mode,
                sessionId,
                decision.hostname,
                target.deckId,
                target.unlockDurationMinutes,
                null
            )
        );
        debug("intervention opened for " + targetKey);
    }

    private boolean shouldSurfaceIntervention(PolicyTarget target) {
        if (!PolicySnapshot.hasText(target.id)) {
            debug("skip: invalid target");
            return false;
        }

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null && !powerManager.isInteractive()) {
            debug("skip: device not interactive");
            return false;
        }

        String foregroundPackage = getForegroundPackage();
        if (!PolicySnapshot.hasText(foregroundPackage)) {
            debug("skip: no foreground package");
            return false;
        }

        if (TextUtils.equals(foregroundPackage, getPackageName())) {
            debug("skip: blearn already in foreground");
            return false;
        }

        if (!TargetMatcher.supportsWebsitePackage(foregroundPackage) && !TargetMatcher.supportsSearchPackage(foregroundPackage)) {
            debug("skip: foreground package outside browser/search allowlist");
            return false;
        }

        return true;
    }

    private String getForegroundPackage() {
        PendingNavigationStore.ForegroundObservation observation =
            PendingNavigationStore.resolveForegroundObservation(this);
        if (PolicySnapshot.hasText(observation.packageName)) {
            return observation.packageName;
        }

        UsageStatsManager usageStatsManager = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        if (usageStatsManager == null) {
            return "";
        }

        long end = System.currentTimeMillis();
        long start = end - 60_000L;
        List<UsageStats> stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end);
        if (stats == null || stats.isEmpty()) {
            return "";
        }

        UsageStats mostRecent = Collections.max(stats, Comparator.comparingLong(UsageStats::getLastTimeUsed));
        String packageName = PolicySnapshot.normalize(mostRecent.getPackageName());
        if (PolicySnapshot.hasText(packageName)) {
            PendingNavigationStore.recordUsageObservation(this, packageName, mostRecent.getLastTimeUsed());
        }
        return packageName;
    }

    private void refreshDecisionEngine() {
        PolicySnapshotReadResult readResult = policyBridge.readSnapshot();
        if (readResult.parseError != null) {
            debug("policy snapshot parse failed: " + readResult.parseError);
        }
        decisionEngine = policyBridge.buildDecisionEngine();
    }

    private int getBlockedWebsiteCount() {
        return policyBridge.readSnapshot().snapshot.websiteTargets.size();
    }

    private void ensureForegroundNotification() {
        if (notificationController == null) {
            notificationController = new VpnNotificationController(this);
        }

        startForeground(
            VpnNotificationController.NOTIFICATION_ID,
            notificationController.buildActiveNotification(getBlockedWebsiteCount())
        );
        foregroundNotificationVisible = true;
    }

    private void shutdownVpn(String reason, boolean stopSelfAfterCleanup) {
        synchronized (stateLock) {
            running = false;
            policyBridge.setVpnActive(false);

            if (packetLoopThread != null && packetLoopThread != Thread.currentThread()) {
                packetLoopThread.interrupt();
            }
            packetLoopThread = null;
            if (dnsForwardExecutor != null) {
                dnsForwardExecutor.shutdownNow();
                dnsForwardExecutor = null;
            }

            if (vpnInterface != null) {
                try {
                    vpnInterface.close();
                } catch (Exception ignored) {
                    // Interface cleanup is best-effort on shutdown.
                }
                vpnInterface = null;
            }

            if (foregroundNotificationVisible) {
                stopForeground(true);
                foregroundNotificationVisible = false;
            }
            debug("vpn stopped: " + reason);
        }

        if (stopSelfAfterCleanup) {
            stopSelf();
        }
    }

    private void ensureDnsForwardExecutor() {
        if (dnsForwardExecutor != null && !dnsForwardExecutor.isShutdown()) {
            return;
        }

        dnsForwardExecutor = new ThreadPoolExecutor(
            DNS_FORWARDER_THREADS,
            DNS_FORWARDER_THREADS,
            30L,
            TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(DNS_FORWARDER_QUEUE_CAPACITY),
            runnable -> {
                Thread thread = new Thread(runnable, "blearn-vpn-dns");
                thread.setDaemon(true);
                return thread;
            },
            new ThreadPoolExecutor.AbortPolicy()
        );
    }

    private void debug(String message) {
        if (isDebuggable()) {
            Log.d(TAG, message);
        }
    }

    private void debug(String message, Throwable error) {
        if (isDebuggable()) {
            Log.d(TAG, message, error);
        }
    }

    private boolean isDebuggable() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }
}
