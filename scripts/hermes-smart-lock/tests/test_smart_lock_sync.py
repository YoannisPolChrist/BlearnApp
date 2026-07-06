from __future__ import annotations

import sys
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from smart_lock_policy import RemoteBlockDecision
from smart_lock_sync import (
    build_instruction,
    get_usage_document_id,
    load_calendar_events,
    plan_remote_update,
)


BERLIN = ZoneInfo("Europe/Berlin")


def at(hour: int) -> datetime:
    return datetime(2026, 7, 2, hour, tzinfo=BERLIN)


class SmartLockSyncTests(unittest.TestCase):
    def test_uses_previous_day_until_threshold_lock_can_expire_at_0800(self) -> None:
        self.assertEqual(get_usage_document_id(at(6)), "2026-07-01")
        self.assertEqual(get_usage_document_id(at(8)), "2026-07-02")

    def test_accepts_only_fresh_calendar_snapshots(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            path = Path(temporary_dir) / "calendar.json"
            event = {"summary": "Nachtschicht"}
            path.write_text(
                json.dumps(
                    {
                        "generatedAt": at(5).isoformat(),
                        "events": [event],
                    }
                ),
                encoding="utf-8",
            )

            self.assertEqual(load_calendar_events(path, now=at(6)), [event])

            path.write_text(
                json.dumps(
                    {
                        "generatedAt": datetime(2026, 6, 30, 5, tzinfo=BERLIN).isoformat(),
                        "events": [event],
                    }
                ),
                encoding="utf-8",
            )
            self.assertEqual(load_calendar_events(path, now=at(6)), [])

    def test_builds_the_blern_remote_blocking_contract(self) -> None:
        decision = RemoteBlockDecision(
            categories=("games",),
            expires_at=at(8),
            reason_codes=("game_limit",),
            browser_minutes=12.5,
            game_minutes=51,
        )

        payload = build_instruction(decision, now=at(6))

        self.assertEqual(payload["ownerId"], "smart-lock-v5")
        self.assertEqual(payload["mode"], "strict")
        self.assertEqual(payload["blockedCategories"], ["games"])
        self.assertEqual(payload["blockedApps"], [])
        self.assertEqual(payload["expiresAt"], int(at(8).timestamp() * 1000))
        self.assertEqual(payload["reasonCodes"], ["game_limit"])
        self.assertEqual(payload["usageMinutes"], {"browser": 12.5, "games": 51})

    def test_active_decision_writes_when_semantics_changed(self) -> None:
        decision = RemoteBlockDecision(
            categories=("browser", "games"),
            expires_at=at(7),
            reason_codes=("bedtime",),
        )

        action = plan_remote_update(
            decision,
            existing={"ownerId": "smart-lock-v5", "blockedCategories": ["games"]},
            now=at(1),
        )

        self.assertEqual(action, "write")

    def test_active_decision_skips_identical_document(self) -> None:
        decision = RemoteBlockDecision(
            categories=("games",),
            expires_at=at(8),
            reason_codes=("game_limit",),
            game_minutes=51,
        )
        existing = build_instruction(decision, now=at(6))
        existing["createdAt"] -= 60_000
        existing["id"] = "older-id"

        action = plan_remote_update(decision, existing=existing, now=at(6))

        self.assertEqual(action, "no_change")

    def test_inactive_decision_deletes_only_owned_instruction(self) -> None:
        inactive = RemoteBlockDecision()

        self.assertEqual(
            plan_remote_update(
                inactive,
                existing={"ownerId": "smart-lock-v5", "expiresAt": int(at(8).timestamp() * 1000)},
                now=at(6),
            ),
            "delete",
        )
        self.assertEqual(
            plan_remote_update(
                inactive,
                existing={"ownerId": "coach-manual", "expiresAt": int(at(8).timestamp() * 1000)},
                now=at(6),
            ),
            "no_change",
        )


if __name__ == "__main__":
    unittest.main()
