package app.blearn.mobile;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class DeviceInteractivePolicyTest {
    @Test
    public void allowsCaptureWhenDeviceIsInteractive() {
        assertTrue(DeviceInteractivePolicy.shouldProcess(true, true));
    }

    @Test
    public void suppressesCaptureWhenDeviceIsNotInteractive() {
        assertFalse(DeviceInteractivePolicy.shouldProcess(true, false));
    }

    @Test
    public void suppressesCaptureWhenInteractiveStateIsUnavailable() {
        assertFalse(DeviceInteractivePolicy.shouldProcess(false, false));
    }
}
