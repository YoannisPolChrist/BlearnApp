from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from calendar_snapshot_sync import build_snapshot, has_calendar_read_scope, is_night_shift


BERLIN = ZoneInfo("Europe/Berlin")


class CalendarSnapshotSyncTests(unittest.TestCase):
    def test_accepts_readonly_or_full_calendar_scope(self) -> None:
        self.assertTrue(
            has_calendar_read_scope(
                ["https://www.googleapis.com/auth/calendar.readonly"]
            )
        )
        self.assertTrue(
            has_calendar_read_scope(["https://www.googleapis.com/auth/calendar"])
        )

    def test_detects_explicit_night_shift_names(self) -> None:
        event = {
            "summary": "Hotel Nachtschicht",
            "start": {"dateTime": "2026-07-02T22:30:00+02:00"},
            "end": {"dateTime": "2026-07-03T07:30:00+02:00"},
        }

        self.assertTrue(is_night_shift(event))

    def test_does_not_treat_every_evening_event_as_a_night_shift(self) -> None:
        event = {
            "summary": "Abendessen",
            "start": {"dateTime": "2026-07-02T22:30:00+02:00"},
            "end": {"dateTime": "2026-07-03T00:30:00+02:00"},
        }

        self.assertFalse(is_night_shift(event))

    def test_snapshot_keeps_full_event_end_for_overlap_checks(self) -> None:
        now = datetime(2026, 7, 2, 18, tzinfo=BERLIN)
        event = {
            "id": "shift-1",
            "summary": "Night Shift",
            "start": {"dateTime": "2026-07-02T22:30:00+02:00"},
            "end": {"dateTime": "2026-07-03T07:30:00+02:00"},
        }

        snapshot = build_snapshot([event], now=now)

        self.assertEqual(snapshot["generatedAt"], now.isoformat())
        self.assertEqual(snapshot["events"], [event])
        self.assertEqual(snapshot["night_shifts"], [event])


if __name__ == "__main__":
    unittest.main()
