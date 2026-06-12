package app.blearn.mobile;

final class PolicyTarget {
    final String id;
    final String type;
    final String mode;
    final String deckId;
    final int requiredCorrectReviews;
    final int unlockDurationMinutes;

    PolicyTarget(
        String id,
        String type,
        String mode,
        String deckId,
        int requiredCorrectReviews,
        int unlockDurationMinutes
    ) {
        this.id = id;
        this.type = type;
        this.mode = mode;
        this.deckId = deckId;
        this.requiredCorrectReviews = requiredCorrectReviews;
        this.unlockDurationMinutes = unlockDurationMinutes;
    }
}
