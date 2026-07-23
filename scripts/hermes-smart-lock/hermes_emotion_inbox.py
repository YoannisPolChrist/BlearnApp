"""Persists Hermes emotion batches as one idempotent file per event.

This is the default bridge between the Firestore cursor reader and a personal
Hermes installation: an agent watches this inbox and only needs to inspect
newly created event files, never the complete Firestore emotion history.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Mapping


DEFAULT_INBOX = Path("/home/trader/.hermes/inbox/emotions")


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"cannot serialise {type(value).__name__}")


def store_events(events: Iterable[Mapping[str, Any]], inbox: Path) -> int:
    inbox.mkdir(parents=True, exist_ok=True)
    stored = 0
    for event in events:
        event_id = event.get("id")
        if not isinstance(event_id, str) or not event_id or "/" in event_id or "\\" in event_id:
            raise ValueError("emotion event requires a safe, non-empty id")
        target = inbox / f"{event_id}.json"
        if target.exists():
            continue
        temporary = inbox / f".{event_id}.tmp"
        temporary.write_text(
            json.dumps(dict(event), default=_json_default, ensure_ascii=False, sort_keys=True),
            encoding="utf-8",
        )
        os.replace(temporary, target)
        stored += 1
    return stored


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        print(f"ERROR invalid Hermes emotion JSON: {error}", file=sys.stderr)
        return 1
    if not isinstance(payload, list) or not all(isinstance(event, Mapping) for event in payload):
        print("ERROR Hermes emotion payload must be a JSON array", file=sys.stderr)
        return 1

    inbox = Path(os.environ.get("HERMES_EMOTION_INBOX", DEFAULT_INBOX))
    stored = store_events(payload, inbox)
    print(json.dumps({"stored": stored, "inbox": str(inbox)}, ensure_ascii=True, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
