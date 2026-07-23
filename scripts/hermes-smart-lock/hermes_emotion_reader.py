"""Incrementally forwards only newly ingested Blearn emotion events to Hermes.

No credentials live here. The existing ``firestore_pull.initialize_firebase``
helper on the Hermes host supplies the authenticated Firestore client and the
fixed personal USER_ID. The reader advances its cloud cursor only after the
configured Hermes handler exits successfully, so retries are idempotent by
event id and no emotion is silently skipped.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Mapping


COACHING_INSTANCE_SCRIPTS = Path("/home/trader/coaching-instance/scripts")
STATE_COLLECTION = "agentState"
STATE_DOCUMENT_ID = "hermesEmotionReader"
EMOTION_COLLECTION = "emotion_logs"
DEFAULT_PAGE_SIZE = 100


@dataclass(frozen=True)
class EventCursor:
    ingested_at: datetime
    event_id: str


def event_sort_key(event: Mapping[str, Any]) -> tuple[datetime, str]:
    ingested_at = event.get("ingested_at")
    event_id = event.get("id")
    if not isinstance(ingested_at, datetime) or not isinstance(event_id, str) or not event_id:
        raise ValueError("emotion event requires datetime ingested_at and non-empty id")
    return ingested_at, event_id


def select_events_after_cursor(
    events: Iterable[Mapping[str, Any]],
    cursor: EventCursor | None,
    *,
    limit: int,
) -> list[Mapping[str, Any]]:
    if limit < 1:
        raise ValueError("limit must be positive")
    cursor_key = (cursor.ingested_at, cursor.event_id) if cursor else None
    ordered = sorted(events, key=event_sort_key)
    return [
        event
        for event in ordered
        if cursor_key is None or event_sort_key(event) > cursor_key
    ][:limit]


def read_cursor(payload: Mapping[str, Any] | None) -> EventCursor | None:
    if not payload:
        return None
    raw_cursor = payload.get("cursor")
    if not isinstance(raw_cursor, Mapping):
        return None
    ingested_at = raw_cursor.get("ingestedAt")
    event_id = raw_cursor.get("eventId")
    if not isinstance(ingested_at, datetime) or not isinstance(event_id, str) or not event_id:
        return None
    return EventCursor(ingested_at, event_id)


def cursor_from_event(event: Mapping[str, Any]) -> EventCursor:
    ingested_at, event_id = event_sort_key(event)
    return EventCursor(ingested_at, event_id)


def fetch_incremental_events(db: Any, user_id: str, cursor: EventCursor | None, *, page_size: int) -> list[dict[str, Any]]:
    """Fetch one bounded page. Firestore performs the cursor filtering."""
    from firebase_admin import firestore

    collection = db.collection("users").document(user_id).collection(EMOTION_COLLECTION)
    document_id = firestore.FieldPath.document_id()
    query = collection.order_by("ingested_at").order_by(document_id)
    if cursor is not None:
        query = query.start_after({"ingested_at": cursor.ingested_at, document_id: cursor.event_id})
    snapshots = query.limit(page_size).stream()
    events: list[dict[str, Any]] = []
    for snapshot in snapshots:
        payload = snapshot.to_dict() or {}
        ingested_at = payload.get("ingested_at")
        if not isinstance(ingested_at, datetime):
            # Legacy events deliberately have no server receipt timestamp and
            # never enter the incremental stream.
            continue
        events.append({**payload, "id": snapshot.id, "ingested_at": ingested_at})
    return list(select_events_after_cursor(events, cursor, limit=page_size))


def bootstrap_cursor(db: Any, user_id: str) -> EventCursor | None:
    """Start at the latest event without replaying the personal history."""
    from firebase_admin import firestore

    document_id = firestore.FieldPath.document_id()
    snapshots = (
        db.collection("users")
        .document(user_id)
        .collection(EMOTION_COLLECTION)
        .order_by("ingested_at", direction=firestore.Query.DESCENDING)
        .order_by(document_id, direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    snapshot = next(iter(snapshots), None)
    if snapshot is None:
        return None
    payload = snapshot.to_dict() or {}
    ingested_at = payload.get("ingested_at")
    return EventCursor(ingested_at, snapshot.id) if isinstance(ingested_at, datetime) else None


def serialise_events(events: list[Mapping[str, Any]]) -> str:
    def default(value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        raise TypeError(f"cannot serialise {type(value).__name__}")

    return json.dumps(events, default=default, ensure_ascii=False)


def deliver_to_hermes(events: list[Mapping[str, Any]], handler: str) -> None:
    if not handler.strip():
        raise RuntimeError("HERMES_EMOTION_HANDLER is required before acknowledging events")
    subprocess.run(
        shlex.split(handler),
        input=serialise_events(events),
        text=True,
        check=True,
    )


def write_cursor(state_ref: Any, cursor: EventCursor | None) -> None:
    payload: dict[str, Any] = {"initialized": True, "updatedAt": datetime.now().astimezone()}
    if cursor is not None:
        payload["cursor"] = {"ingestedAt": cursor.ingested_at, "eventId": cursor.event_id}
    state_ref.set(payload, merge=True)


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

    page_size = max(1, int(os.environ.get("HERMES_EMOTION_PAGE_SIZE", DEFAULT_PAGE_SIZE)))
    dry_run = os.environ.get("HERMES_EMOTION_DRY_RUN") == "1"
    handler = os.environ.get("HERMES_EMOTION_HANDLER", "")
    state_ref = db.collection("users").document(USER_ID).collection(STATE_COLLECTION).document(STATE_DOCUMENT_ID)
    state_snapshot = state_ref.get()
    cursor = read_cursor(state_snapshot.to_dict() if state_snapshot.exists else None)

    if not state_snapshot.exists:
        cursor = bootstrap_cursor(db, USER_ID)
        if not dry_run:
            write_cursor(state_ref, cursor)
        print("HERMES_EMOTIONS " + json.dumps({"action": "bootstrapped", "count": 0}, sort_keys=True))
        return 0

    events = fetch_incremental_events(db, USER_ID, cursor, page_size=page_size)
    if not events:
        print("HERMES_EMOTIONS " + json.dumps({"action": "no_change", "count": 0}, sort_keys=True))
        return 0

    if dry_run:
        print("HERMES_EMOTIONS " + json.dumps({"action": "dry_run", "count": len(events)}, sort_keys=True))
        return 0

    deliver_to_hermes(events, handler)
    write_cursor(state_ref, cursor_from_event(events[-1]))
    print("HERMES_EMOTIONS " + json.dumps({"action": "delivered", "count": len(events)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
