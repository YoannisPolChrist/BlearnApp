from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from smart_lock_policy import UsageThresholds, evaluate_smart_lock


BERLIN = ZoneInfo("Europe/Berlin")


def at(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=BERLIN)


def usage(package_name: str, label: str, minutes: float) -> dict:
    return {
        "packageName": package_name,
        "label": label,
        "totalTimeMs": int(minutes * 60_000),
    }


def night_shift(start: str, end: str) -> dict:
    return {
        "summary": "Nachtschicht Hotel",
        "start": {"dateTime": start},
        "end": {"dateTime": end},
    }


class SmartLockPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.thresholds = UsageThresholds(browser_minutes=60, game_minutes=45)

    def test_browser_threshold_blocks_only_browsers_until_next_0800(self) -> None:
        decision = evaluate_smart_lock(
            now=at(2026, 7, 2, 14),
            usage_apps=[usage("com.android.chrome", "Chrome", 61)],
            calendar_events=[],
            thresholds=self.thresholds,
        )

        self.assertEqual(decision.categories, ("browser",))
        self.assertEqual(decision.reason_codes, ("browser_limit",))
        self.assertEqual(decision.expires_at, at(2026, 7, 3, 8))

    def test_game_threshold_blocks_only_games_until_next_0800(self) -> None:
        decision = evaluate_smart_lock(
            now=at(2026, 7, 2, 14),
            usage_apps=[usage("com.king.candycrushsaga", "Candy Crush", 46)],
            calendar_events=[],
            thresholds=self.thresholds,
        )

        self.assertEqual(decision.categories, ("games",))
        self.assertEqual(decision.reason_codes, ("game_limit",))
        self.assertEqual(decision.expires_at, at(2026, 7, 3, 8))

    def test_normal_night_blocks_browsers_and_games_until_0700(self) -> None:
        decision = evaluate_smart_lock(
            now=at(2026, 7, 2, 23),
            usage_apps=[],
            calendar_events=[],
            thresholds=self.thresholds,
        )

        self.assertEqual(decision.categories, ("browser", "games"))
        self.assertEqual(decision.reason_codes, ("bedtime",))
        self.assertEqual(decision.expires_at, at(2026, 7, 3, 7))

    def test_night_shift_overlapping_sleep_window_disables_bedtime_block(self) -> None:
        decision = evaluate_smart_lock(
            now=at(2026, 7, 2, 23),
            usage_apps=[],
            calendar_events=[
                night_shift("2026-07-02T22:30:00+02:00", "2026-07-03T07:30:00+02:00")
            ],
            thresholds=self.thresholds,
        )

        self.assertFalse(decision.active)

    def test_shift_started_previous_evening_is_detected_after_midnight(self) -> None:
        decision = evaluate_smart_lock(
            now=at(2026, 7, 3, 1),
            usage_apps=[],
            calendar_events=[
                night_shift("2026-07-02T22:30:00+02:00", "2026-07-03T07:30:00+02:00")
            ],
            thresholds=self.thresholds,
        )

        self.assertFalse(decision.active)

    def test_existing_threshold_lock_survives_midnight_and_outlasts_bedtime(self) -> None:
        decision = evaluate_smart_lock(
            now=at(2026, 7, 3, 1),
            usage_apps=[],
            calendar_events=[],
            thresholds=self.thresholds,
            existing_instruction={
                "ownerId": "smart-lock-v5",
                "expiresAt": int(at(2026, 7, 3, 8).timestamp() * 1000),
                "blockedCategories": ["games"],
                "reasonCodes": ["game_limit"],
            },
        )

        self.assertEqual(decision.categories, ("browser", "games"))
        self.assertEqual(decision.reason_codes, ("bedtime", "game_limit"))
        self.assertEqual(decision.expires_at, at(2026, 7, 3, 8))

    def test_threshold_uses_daily_app_usage_document_shape(self) -> None:
        decision = evaluate_smart_lock(
            now=at(2026, 7, 2, 14),
            usage_apps=[
                usage("com.android.chrome", "Chrome", 30.5),
                usage("org.mozilla.firefox", "Firefox", 30.0),
            ],
            calendar_events=[],
            thresholds=self.thresholds,
        )

        self.assertEqual(decision.browser_minutes, 60.5)
        self.assertEqual(decision.categories, ("browser",))


if __name__ == "__main__":
    unittest.main()
