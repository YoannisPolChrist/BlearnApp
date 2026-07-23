from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from hermes_emotion_reader import EventCursor, select_events_after_cursor


class HermesEmotionReaderTests(unittest.TestCase):
    def test_selects_only_events_strictly_after_the_saved_cursor(self) -> None:
        first = datetime(2026, 7, 18, 10, tzinfo=timezone.utc)
        second = datetime(2026, 7, 18, 11, tzinfo=timezone.utc)
        cursor = EventCursor(first, "emotion-b")
        events = [
            {"id": "emotion-a", "ingested_at": first},
            {"id": "emotion-b", "ingested_at": first},
            {"id": "emotion-c", "ingested_at": first},
            {"id": "emotion-d", "ingested_at": second},
        ]

        selected = select_events_after_cursor(events, cursor, limit=10)

        self.assertEqual([event["id"] for event in selected], ["emotion-c", "emotion-d"])

    def test_limits_a_page_without_advancing_over_unprocessed_events(self) -> None:
        timestamp = datetime(2026, 7, 18, 10, tzinfo=timezone.utc)
        events = [
            {"id": "emotion-a", "ingested_at": timestamp},
            {"id": "emotion-b", "ingested_at": timestamp},
            {"id": "emotion-c", "ingested_at": timestamp},
        ]

        selected = select_events_after_cursor(events, None, limit=2)

        self.assertEqual([event["id"] for event in selected], ["emotion-a", "emotion-b"])


if __name__ == "__main__":
    unittest.main()
