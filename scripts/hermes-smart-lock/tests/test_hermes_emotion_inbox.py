from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from hermes_emotion_inbox import store_events


class HermesEmotionInboxTests(unittest.TestCase):
    def test_stores_each_new_emotion_as_one_idempotent_inbox_file(self) -> None:
        event = {
            "id": "emotion-123",
            "ingested_at": datetime(2026, 7, 18, 10, tzinfo=timezone.utc),
            "emotion": {"primary": "calm"},
        }
        with tempfile.TemporaryDirectory() as temporary_dir:
            inbox = Path(temporary_dir)

            self.assertEqual(store_events([event], inbox), 1)
            self.assertEqual(store_events([{**event, "emotion": {"primary": "changed"}}], inbox), 0)

            payload = json.loads((inbox / "emotion-123.json").read_text(encoding="utf-8"))
            self.assertEqual(payload["emotion"]["primary"], "calm")
            self.assertEqual(payload["ingested_at"], "2026-07-18T10:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
