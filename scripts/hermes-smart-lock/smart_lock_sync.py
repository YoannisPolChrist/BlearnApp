from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Literal, Mapping
from zoneinfo import ZoneInfo

from fcm_push import push_block, push_clear, resolve_block_packages
from smart_lock_policy import (
    SMART_LOCK_OWNER_ID,
    RemoteBlockDecision,
    UsageThresholds,
    evaluate_smart_lock,
)


UpdateAction = Literal["write", "delete", "no_change"]
BERLIN = ZoneInfo("Europe/Berlin")
REMOTE_DOCUMENT_ID = "latest"
DEFAULT_THRESHOLDS = UsageThresholds(browser_minutes=60, game_minutes=45)
CALENDAR_SNAPSHOT_PATH = Path(
    "/home/trader/.hermes/profiles/coaching/calendar-cache/daily_snapshot.json"
)
COACHING_INSTANCE_SCRIPTS = Path("/home/trader/coaching-instance/scripts")


def build_instruction(decision: RemoteBlockDecision, *, now: datetime) -> dict:
    if not decision.active or decision.expires_at is None:
        raise ValueError("cannot build an instruction for an inactive decision")
    expires_at_ms = int(decision.expires_at.timestamp() * 1000)
    now_ms = int(now.timestamp() * 1000)
    identity_source = json.dumps(
        {
            "categories": decision.categories,
            "expiresAt": expires_at_ms,
            "reasons": decision.reason_codes,
        },
        sort_keys=True,
    )
    identity = hashlib.sha256(identity_source.encode("utf-8")).hexdigest()[:12]
    return {
        "id": f"{SMART_LOCK_OWNER_ID}-{identity}",
        "ownerId": SMART_LOCK_OWNER_ID,
        "triggeredBy": "perri_smart_lock",
        "createdAt": now_ms,
        "expiresAt": expires_at_ms,
        "durationMinutes": max(1, int((expires_at_ms - now_ms) / 60_000)),
        "blockedApps": [],
        "blockedCategories": list(decision.categories),
        "mode": "strict",
        "reasonCodes": list(decision.reason_codes),
        "reason": _reason_text(decision.reason_codes),
        "usageMinutes": {
            "browser": decision.browser_minutes,
            "games": decision.game_minutes,
        },
    }


def plan_remote_update(
    decision: RemoteBlockDecision,
    *,
    existing: Mapping[str, object] | None,
    now: datetime,
) -> UpdateAction:
    if not decision.active:
        return "delete" if existing and existing.get("ownerId") == SMART_LOCK_OWNER_ID else "no_change"
    if existing is None:
        return "write"
    desired = build_instruction(decision, now=now)
    semantic_keys = (
        "ownerId",
        "expiresAt",
        "blockedApps",
        "blockedCategories",
        "mode",
        "reasonCodes",
    )
    if all(existing.get(key) == desired.get(key) for key in semantic_keys):
        return "no_change"
    return "write"


def _reason_text(reason_codes: tuple[str, ...]) -> str:
    labels = {
        "bedtime": "Schlafenszeit 22:00-07:00",
        "browser_limit": "Browser-Tageslimit erreicht",
        "game_limit": "Spiele-Tageslimit erreicht",
    }
    return "; ".join(labels[code] for code in reason_codes if code in labels)


def get_usage_document_id(now: datetime) -> str:
    local_now = now.astimezone(BERLIN)
    usage_day = local_now - timedelta(days=1) if local_now.time() < time(8) else local_now
    return usage_day.strftime("%Y-%m-%d")


def load_calendar_events(
    path: Path,
    *,
    now: datetime,
    max_age_hours: int = 30,
) -> list[dict]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        generated_at_raw = payload.get("generatedAt")
        if not isinstance(generated_at_raw, str):
            return []
        generated_at = datetime.fromisoformat(generated_at_raw.replace("Z", "+00:00"))
        if generated_at.tzinfo is None:
            return []
        age = now - generated_at.astimezone(now.tzinfo)
        if age < -timedelta(minutes=5) or age > timedelta(hours=max_age_hours):
            return []
        events = payload.get("events")
        night_shifts = payload.get("night_shifts")
        combined = []
        for values in (events, night_shifts):
            if isinstance(values, list):
                combined.extend(value for value in values if isinstance(value, dict))
        return combined
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return []


def main() -> int:
    sys.path.insert(0, str(COACHING_INSTANCE_SCRIPTS))
    try:
        from firestore_pull import USER_ID, initialize_firebase
    except ImportError as error:
        print(f"ERROR firestore helper unavailable: {error}")
        return 1

    db = initialize_firebase()
    if not db:
        print("ERROR firebase unavailable")
        return 1

    now = datetime.now(tz=BERLIN)
    usage_document_id = get_usage_document_id(now)
    usage_snapshot = (
        db.collection("users")
        .document(USER_ID)
        .collection("appUsage")
        .document(usage_document_id)
        .get()
    )
    usage_payload = usage_snapshot.to_dict() if usage_snapshot.exists else {}
    usage_apps = usage_payload.get("apps") if isinstance(usage_payload, dict) else []
    if not isinstance(usage_apps, list):
        usage_apps = []

    remote_ref = (
        db.collection("users")
        .document(USER_ID)
        .collection("remoteBlocking")
        .document(REMOTE_DOCUMENT_ID)
    )
    remote_snapshot = remote_ref.get()
    existing = remote_snapshot.to_dict() if remote_snapshot.exists else None
    calendar_events = load_calendar_events(CALENDAR_SNAPSHOT_PATH, now=now)
    decision = evaluate_smart_lock(
        now=now,
        usage_apps=usage_apps,
        calendar_events=calendar_events,
        thresholds=DEFAULT_THRESHOLDS,
        existing_instruction=existing,
    )
    action = plan_remote_update(decision, existing=existing, now=now)
    dry_run = os.environ.get("SMART_LOCK_DRY_RUN") == "1"

    summary = {
        "action": action,
        "dryRun": dry_run,
        "usageDocument": usage_document_id,
        "usageApps": len(usage_apps),
        "calendarEvents": len(calendar_events),
        "browserMinutes": decision.browser_minutes,
        "gameMinutes": decision.game_minutes,
        "categories": list(decision.categories),
        "reasonCodes": list(decision.reason_codes),
        "expiresAt": decision.expires_at.isoformat() if decision.expires_at else None,
    }
    if dry_run:
        print("DRY_RUN " + json.dumps(summary, ensure_ascii=True, sort_keys=True))
        return 0

    pushed = 0
    if action == "write":
        instruction = build_instruction(decision, now=now)
        remote_ref.set(instruction)
        # Wake the device so the block engages even with the app closed.
        packages = resolve_block_packages(decision.categories, usage_apps)
        pushed = push_block(
            db,
            USER_ID,
            packages=packages,
            expires_at_ms=instruction["expiresAt"],
            mode=instruction.get("mode", "strict"),
        )
    elif action == "delete":
        remote_ref.delete()
        pushed = push_clear(db, USER_ID)
    summary["pushedDevices"] = pushed
    print("SMART_LOCK " + json.dumps(summary, ensure_ascii=True, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
