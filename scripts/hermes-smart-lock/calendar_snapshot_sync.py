from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Mapping
from zoneinfo import ZoneInfo


BERLIN = ZoneInfo("Europe/Berlin")
CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar"
CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
TOKEN_CANDIDATES = (
    Path("/home/trader/coaching-instance/credentials/token.json"),
    Path("/home/trader/.hermes/google_token.json"),
)
SNAPSHOT_PATH = Path(
    "/home/trader/.hermes/profiles/coaching/calendar-cache/daily_snapshot.json"
)
_NIGHT_SHIFT_MARKERS = (
    "nachtschicht",
    "nacht schicht",
    "night shift",
    "nightshift",
)


def has_calendar_read_scope(scopes: Iterable[str]) -> bool:
    available = set(scopes)
    return bool({CALENDAR_SCOPE, CALENDAR_READONLY_SCOPE}.intersection(available))


def is_night_shift(event: Mapping[str, object]) -> bool:
    summary = str(event.get("summary") or "").strip().lower()
    return any(marker in summary for marker in _NIGHT_SHIFT_MARKERS)


def build_snapshot(
    events: Iterable[Mapping[str, object]],
    *,
    now: datetime,
) -> dict:
    event_list = [dict(event) for event in events]
    return {
        "generatedAt": now.isoformat(),
        "events": event_list,
        "night_shifts": [event for event in event_list if is_night_shift(event)],
    }


def _load_calendar_credentials():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    errors = []
    for token_path in TOKEN_CANDIDATES:
        if not token_path.exists():
            continue
        try:
            credentials = Credentials.from_authorized_user_file(str(token_path))
            if not has_calendar_read_scope(credentials.scopes or []):
                errors.append(f"{token_path}: calendar scope missing")
                continue
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
                token_path.write_text(credentials.to_json(), encoding="utf-8")
            if credentials.valid:
                return credentials
            errors.append(f"{token_path}: credentials invalid")
        except Exception as error:
            errors.append(f"{token_path}: {type(error).__name__}")
    raise RuntimeError("No valid Calendar credentials (" + ", ".join(errors) + ")")


def _fetch_calendar_events(credentials, now: datetime) -> list[dict]:
    from googleapiclient.discovery import build

    service = build("calendar", "v3", credentials=credentials, cache_discovery=False)
    start = (now - timedelta(hours=24)).astimezone(timezone.utc)
    end = (now + timedelta(hours=36)).astimezone(timezone.utc)
    result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=start.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    return [event for event in result.get("items", []) if isinstance(event, dict)]


def _write_snapshot_atomic(path: Path, payload: Mapping[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=".calendar-", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as temporary_file:
            json.dump(payload, temporary_file, ensure_ascii=True, indent=2)
            temporary_file.write("\n")
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_name, path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def main() -> int:
    now = datetime.now(tz=BERLIN)
    try:
        credentials = _load_calendar_credentials()
        events = _fetch_calendar_events(credentials, now)
        snapshot = build_snapshot(events, now=now)
        _write_snapshot_atomic(SNAPSHOT_PATH, snapshot)
    except Exception as error:
        print(f"ERROR calendar snapshot unavailable: {type(error).__name__}: {error}")
        return 1

    print(
        "CALENDAR_SYNC "
        + json.dumps(
            {
                "events": len(snapshot["events"]),
                "nightShifts": len(snapshot["night_shifts"]),
                "generatedAt": snapshot["generatedAt"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
