package app.blearn.mobile;

final class PolicyMatch {
    final PolicyTarget target;
    final String displayLabel;
    final String source;

    PolicyMatch(PolicyTarget target, String displayLabel, String source) {
        this.target = target;
        this.displayLabel = displayLabel;
        this.source = source;
    }
}
