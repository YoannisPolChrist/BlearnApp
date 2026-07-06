from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Iterable, Mapping, Sequence


SMART_LOCK_OWNER_ID = "smart-lock-v5"
_BROWSER_PACKAGES = {
    "com.android.chrome",
    "com.brave.browser",
    "com.chrome.beta",
    "com.chrome.canary",
    "com.chrome.dev",
    "com.duckduckgo.mobile.android",
    "com.ecosia.android",
    "com.microsoft.emmx",
    "com.opera.browser",
    "com.opera.mini.native",
    "com.samsung.android.browser",
    "com.vivaldi.browser",
    "org.chromium.chrome",
    "org.mozilla.firefox",
    "org.mozilla.focus",
    "org.torproject.torbrowser",
}
_BROWSER_MARKERS = (
    "browser",
    "brave",
    "chrome",
    "chromium",
    "duckduckgo",
    "ecosia",
    "edge",
    "firefox",
    "opera",
    "safari",
    "tor browser",
    "vivaldi",
)
_GAME_MARKERS = (
    "angrybirds",
    "candy",
    "clash",
    "epicgames",
    "fortnite",
    "game",
    "gameloft",
    "gaming",
    "genshin",
    "king.com",
    "minecraft",
    "mihoyo",
    "mojang",
    "nintendo",
    "pokemon",
    "pubg",
    "roblox",
    "rovio",
    "supercell",
    "ubisoft",
)
_NIGHT_SHIFT_MARKERS = (
    "nachtschicht",
    "nacht schicht",
    "night shift",
    "nightshift",
)
_REASON_ORDER = ("bedtime", "browser_limit", "game_limit")


@dataclass(frozen=True)
class UsageThresholds:
    browser_minutes: float
    game_minutes: float


@dataclass(frozen=True)
class RemoteBlockDecision:
    categories: tuple[str, ...] = ()
    expires_at: datetime | None = None
    reason_codes: tuple[str, ...] = ()
    browser_minutes: float = 0
    game_minutes: float = 0

    @property
    def active(self) -> bool:
        return bool(self.categories and self.expires_at)


def evaluate_smart_lock(
    *,
    now: datetime,
    usage_apps: Sequence[Mapping[str, object]],
    calendar_events: Iterable[Mapping[str, object]],
    thresholds: UsageThresholds,
    existing_instruction: Mapping[str, object] | None = None,
) -> RemoteBlockDecision:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")

    browser_minutes = 0.0
    game_minutes = 0.0
    for app in usage_apps:
        minutes = _as_minutes(app.get("totalTimeMs"))
        package_name = str(app.get("packageName") or "").strip().lower()
        label = str(app.get("label") or "").strip().lower()
        haystack = f"{package_name} {label}"
        if _is_browser(package_name, haystack):
            browser_minutes += minutes
        if _is_game(haystack):
            game_minutes += minutes

    categories: set[str] = set()
    reason_codes: set[str] = set()
    expiries: list[datetime] = []

    if browser_minutes >= thresholds.browser_minutes:
        categories.add("browser")
        reason_codes.add("browser_limit")
        expiries.append(_next_local_time(now, time(8, 0)))

    if game_minutes >= thresholds.game_minutes:
        categories.add("games")
        reason_codes.add("game_limit")
        expiries.append(_next_local_time(now, time(8, 0)))

    existing_expiry = _existing_threshold_expiry(existing_instruction, now)
    if existing_expiry is not None and existing_instruction is not None:
        existing_categories = existing_instruction.get("blockedCategories")
        existing_reasons = existing_instruction.get("reasonCodes")
        if isinstance(existing_categories, list):
            categories.update(
                value for value in existing_categories if value in {"browser", "games"}
            )
        if isinstance(existing_reasons, list):
            reason_codes.update(
                value for value in existing_reasons if value in {"browser_limit", "game_limit"}
            )
        expiries.append(existing_expiry)

    sleep_window = _sleep_window(now)
    if sleep_window is not None:
        window_start, window_end = sleep_window
        has_night_shift = any(
            _event_overlaps_night_window(event, window_start, window_end)
            for event in calendar_events
        )
        if not has_night_shift:
            categories.update(("browser", "games"))
            reason_codes.add("bedtime")
            expiries.append(window_end)

    return RemoteBlockDecision(
        categories=tuple(value for value in ("browser", "games") if value in categories),
        expires_at=max(expiries) if expiries else None,
        reason_codes=tuple(value for value in _REASON_ORDER if value in reason_codes),
        browser_minutes=round(browser_minutes, 3),
        game_minutes=round(game_minutes, 3),
    )


def _as_minutes(total_time_ms: object) -> float:
    if not isinstance(total_time_ms, (int, float)) or total_time_ms <= 0:
        return 0.0
    return float(total_time_ms) / 60_000.0


def _is_browser(package_name: str, haystack: str) -> bool:
    return package_name in _BROWSER_PACKAGES or any(
        marker in haystack for marker in _BROWSER_MARKERS
    )


def _is_game(haystack: str) -> bool:
    return any(marker in haystack for marker in _GAME_MARKERS)


def _next_local_time(now: datetime, target: time) -> datetime:
    candidate = now.replace(
        hour=target.hour,
        minute=target.minute,
        second=0,
        microsecond=0,
    )
    if now >= candidate:
        candidate += timedelta(days=1)
    return candidate


def _sleep_window(now: datetime) -> tuple[datetime, datetime] | None:
    if now.time() >= time(22, 0):
        start = now.replace(hour=22, minute=0, second=0, microsecond=0)
        return start, (start + timedelta(days=1)).replace(hour=7)
    if now.time() < time(7, 0):
        end = now.replace(hour=7, minute=0, second=0, microsecond=0)
        return (end - timedelta(days=1)).replace(hour=22), end
    return None


def _event_overlaps_night_window(
    event: Mapping[str, object],
    window_start: datetime,
    window_end: datetime,
) -> bool:
    summary = str(event.get("summary") or "").lower()
    if not any(marker in summary for marker in _NIGHT_SHIFT_MARKERS):
        return False

    event_start = _parse_event_datetime(event.get("start"), window_start)
    event_end = _parse_event_datetime(event.get("end"), window_start)
    if event_start is None:
        return False
    if event_end is None:
        event_end = event_start + timedelta(hours=8)
    return event_start < window_end and event_end > window_start


def _parse_event_datetime(value: object, reference: datetime) -> datetime | None:
    if not isinstance(value, Mapping):
        return None
    raw = value.get("dateTime")
    if not isinstance(raw, str) or not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=reference.tzinfo)
    return parsed.astimezone(reference.tzinfo)


def _existing_threshold_expiry(
    existing_instruction: Mapping[str, object] | None,
    now: datetime,
) -> datetime | None:
    if not existing_instruction or existing_instruction.get("ownerId") != SMART_LOCK_OWNER_ID:
        return None
    reasons = existing_instruction.get("reasonCodes")
    if not isinstance(reasons, list) or not {
        "browser_limit",
        "game_limit",
    }.intersection(reasons):
        return None
    raw_expiry = existing_instruction.get("expiresAt")
    if not isinstance(raw_expiry, (int, float)):
        return None
    expiry = datetime.fromtimestamp(float(raw_expiry) / 1000, tz=now.tzinfo)
    return expiry if expiry > now else None
