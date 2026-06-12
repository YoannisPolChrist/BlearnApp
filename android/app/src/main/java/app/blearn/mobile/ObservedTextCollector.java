package app.blearn.mobile;

import android.accessibilityservice.AccessibilityService;
import android.os.Build;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class ObservedTextCollector {
    private static final int MAX_NODE_COUNT = 180;
    private static final int MAX_NODE_DEPTH = 8;

    private ObservedTextCollector() {
    }

    static String collect(AccessibilityService service, AccessibilityEvent event) {
        LinkedHashSet<String> parts = new LinkedHashSet<>();

        List<CharSequence> eventText = event.getText();
        if (eventText != null) {
            for (CharSequence value : eventText) {
                appendText(parts, value);
            }
        }
        appendText(parts, event.getContentDescription());

        AccessibilityNodeInfo source = null;
        try {
            source = event.getSource();
            if (source != null) {
                int[] nodeCounter = new int[] { 0 };
                appendNodeText(parts, source, 0, nodeCounter);
            }
        } catch (RuntimeException ignored) {
            // Accessibility nodes can become stale mid-traversal on some OEM builds.
        } finally {
            safeRecycle(source);
        }

        AccessibilityNodeInfo root = null;
        try {
            root = service.getRootInActiveWindow();
            if (root != null) {
                int[] nodeCounter = new int[] { 0 };
                appendNodeText(parts, root, 0, nodeCounter);
            }
        } catch (RuntimeException ignored) {
            // Root window access is best-effort only.
        } finally {
            safeRecycle(root);
        }

        return PolicySnapshot.normalize(TextUtils.join(" ", parts));
    }

    private static void appendNodeText(Set<String> parts, AccessibilityNodeInfo node, int depth, int[] nodeCounter) {
        if (node == null || depth > MAX_NODE_DEPTH || nodeCounter[0] >= MAX_NODE_COUNT) return;
        nodeCounter[0] += 1;

        try {
            appendText(parts, node.getText());
            appendText(parts, node.getContentDescription());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                appendText(parts, node.getPaneTitle());
            }
            appendText(parts, node.getViewIdResourceName());

            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = null;
                try {
                    child = node.getChild(index);
                    if (child == null) continue;
                    appendNodeText(parts, child, depth + 1, nodeCounter);
                } catch (RuntimeException ignored) {
                    // Child nodes can disappear while traversing dynamic views.
                } finally {
                    safeRecycle(child);
                }
            }
        } catch (RuntimeException ignored) {
            // Ignore stale nodes and keep the partial text we already collected.
        }
    }

    private static void appendText(Set<String> parts, CharSequence value) {
        if (value == null) return;

        String normalized = value.toString().trim();
        if (!normalized.isEmpty()) {
            parts.add(normalized);
        }
    }

    private static void safeRecycle(AccessibilityNodeInfo node) {
        if (node == null) return;
        try {
            node.recycle();
        } catch (RuntimeException ignored) {
            // Ignore stale or already recycled nodes.
        }
    }
}
