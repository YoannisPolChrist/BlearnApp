package app.blearn.mobile;

final class DeviceInteractivePolicy {
    private DeviceInteractivePolicy() {
    }

    static boolean shouldProcess(boolean powerManagerAvailable, boolean interactive) {
        return powerManagerAvailable && interactive;
    }
}
