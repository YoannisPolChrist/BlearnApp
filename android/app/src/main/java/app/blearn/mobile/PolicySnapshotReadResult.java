package app.blearn.mobile;

final class PolicySnapshotReadResult {
    final PolicySnapshot snapshot;
    final String parseError;

    PolicySnapshotReadResult(PolicySnapshot snapshot, String parseError) {
        this.snapshot = snapshot;
        this.parseError = parseError;
    }
}
