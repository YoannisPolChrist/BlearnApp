"""Push a resolved coach-block to the phone via FCM data messages.

Writing the ``remoteBlocking/latest`` doc is not enough on its own: aggressive
OEMs (MIUI/Xiaomi) kill the app process, so the Firestore listener is dead and
the block never reaches the native layer until the user opens the app. A
high-priority FCM data message wakes ``BlearnMessagingService`` even with the
app closed, carrying the already-resolved package list so the device can start
enforcing immediately without a Firestore read.
"""
from __future__ import annotations

from typing import Iterable, Mapping, Sequence

from smart_lock_policy import _BROWSER_PACKAGES, _is_browser, _is_game

# Curated popular game packages. The device also contributes its own game
# packages from the usage doc (see resolve_block_packages), so this list only
# needs to cover apps that may not yet appear in usage data.
COMMON_GAME_PACKAGES = (
    "com.activision.callofduty.shooter",
    "com.dts.freefireth",
    "com.king.candycrushsaga",
    "com.miHoYo.GenshinImpact",
    "com.mojang.minecraftpe",
    "com.nintendo.zara",
    "com.roblox.client",
    "com.supercell.brawlstars",
    "com.supercell.clashofclans",
    "com.supercell.clashroyale",
    "com.tencent.ig",
)


def resolve_block_packages(
    categories: Sequence[str],
    usage_apps: Iterable[Mapping[str, object]],
) -> list[str]:
    """Turns the abstract categories into concrete package names.

    Combines a curated list per category with the device's own usage data so
    device-specific browsers/games are covered too.
    """
    wanted = set(categories)
    packages: set[str] = set()

    if "browser" in wanted:
        packages.update(_BROWSER_PACKAGES)
    if "games" in wanted:
        packages.update(COMMON_GAME_PACKAGES)

    for app in usage_apps:
        package_name = str(app.get("packageName") or "").strip().lower()
        if not package_name:
            continue
        label = str(app.get("label") or "").strip().lower()
        haystack = f"{package_name} {label}"
        if "browser" in wanted and _is_browser(package_name, haystack):
            packages.add(package_name)
        if "games" in wanted and _is_game(haystack):
            packages.add(package_name)

    return sorted(packages)


def _device_tokens(db, user_id: str) -> list[str]:
    tokens: list[str] = []
    try:
        devices = db.collection("users").document(user_id).collection("devices").stream()
        for device in devices:
            data = device.to_dict() or {}
            token = data.get("fcmToken")
            if isinstance(token, str) and token.strip():
                tokens.append(token.strip())
    except Exception as error:  # noqa: BLE001 - best-effort, never break the sync
        print(f"WARN could not read device tokens: {error}")
    return tokens


def _send_data_message(messaging, token: str, data: dict) -> bool:
    message = messaging.Message(
        data=data,
        token=token,
        android=messaging.AndroidConfig(priority="high"),
    )
    try:
        messaging.send(message)
        return True
    except Exception as error:  # noqa: BLE001
        print(f"WARN FCM send failed for one device: {error}")
        return False


def push_block(
    db,
    user_id: str,
    *,
    packages: Sequence[str],
    expires_at_ms: int,
    mode: str = "strict",
) -> int:
    """Sends an apply push to every registered device. Returns #delivered."""
    if not packages:
        return 0
    try:
        from firebase_admin import messaging
    except ImportError as error:
        print(f"WARN firebase_admin.messaging unavailable: {error}")
        return 0

    tokens = _device_tokens(db, user_id)
    if not tokens:
        print("WARN no registered device tokens — push skipped")
        return 0

    data = {
        "type": "remote_block",
        "action": "apply",
        "packages": ",".join(packages),
        "expiresAt": str(int(expires_at_ms)),
        "mode": mode,
    }
    delivered = sum(1 for token in tokens if _send_data_message(messaging, token, data))
    return delivered


def push_clear(db, user_id: str) -> int:
    """Sends a clear push so the device drops the overlay before its expiry."""
    try:
        from firebase_admin import messaging
    except ImportError as error:
        print(f"WARN firebase_admin.messaging unavailable: {error}")
        return 0

    tokens = _device_tokens(db, user_id)
    if not tokens:
        return 0

    data = {"type": "remote_block", "action": "clear"}
    return sum(1 for token in tokens if _send_data_message(messaging, token, data))
