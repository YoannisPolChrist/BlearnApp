package app.blearn.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class InterventionRouteBuilderTest {
    @Test
    public void buildsInterventionRoutesForAllTargetTypes() {
        String appRoute = InterventionRouteBuilder.buildInterventionRoute(
            new PolicyTarget("com.instagram.android", "app", "strict", null, 0, 0),
            "Instagram",
            "session-app"
        );
        String websiteRoute = InterventionRouteBuilder.buildInterventionRoute(
            new PolicyTarget("youtube.com", "website", "learn", null, 0, 0),
            "youtube.com",
            "session-website"
        );
        String searchRoute = InterventionRouteBuilder.buildInterventionRoute(
            new PolicyTarget("doomscrolling", "search", "penalty", null, 0, 0),
            "doomscrolling",
            "session-search"
        );

        assertTrue(appRoute.contains("targetId=com.instagram.android"));
        assertTrue(appRoute.contains("targetType=app"));
        assertTrue(appRoute.contains("mode=strict"));
        assertTrue(appRoute.contains("overlaySessionId=session-app"));
        assertTrue(websiteRoute.contains("targetId=youtube.com"));
        assertTrue(websiteRoute.contains("targetType=website"));
        assertTrue(websiteRoute.contains("mode=learn"));
        assertTrue(websiteRoute.contains("overlaySessionId=session-website"));
        assertTrue(searchRoute.contains("targetId=doomscrolling"));
        assertTrue(searchRoute.contains("targetType=search"));
        assertTrue(searchRoute.contains("mode=penalty"));
        assertTrue(searchRoute.contains("overlaySessionId=session-search"));
    }

    @Test
    public void buildsLearnRouteWithOptionalDeck() {
        String route = InterventionRouteBuilder.buildLearnRoute("youtube.com", "website", "deck_focus");

        assertEquals("/learn/review?targetId=youtube.com&targetType=website&deckId=deck_focus&mode=learn", route);
    }

    @Test
    public void buildsLearnRouteDirectlyToReviewWithOverlayContext() {
        String route = InterventionRouteBuilder.buildLearnRoute(
            "com.instagram.android",
            "app",
            "deck_focus",
            "Instagram",
            12,
            "session-learn"
        );

        assertEquals(
            "/learn/review?targetId=com.instagram.android&targetType=app&deckId=deck_focus&targetLabel=Instagram&mode=learn&overlaySessionId=session-learn&unlockDurationMinutes=12",
            route
        );
    }

    @Test
    public void keepsReflectionAliasRoutesOnIntervention() {
        String route = InterventionRouteBuilder.buildBlockingRoute(
            new PolicyTarget("youtube.com", "website", "reflection", null, 0, 11),
            "YouTube",
            "session-reflection"
        );

        assertEquals(
            "/intervention?targetId=youtube.com&targetType=website&targetLabel=YouTube&mode=reflection&overlaySessionId=session-reflection&unlockDurationMinutes=11",
            route
        );
    }
}
