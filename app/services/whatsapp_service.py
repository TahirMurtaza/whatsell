"""
WASenderAPI client.

Handles:
- Sending text messages via the WASenderAPI REST API
- Parsing incoming webhook payloads (messages.upsert event)
- Webhook signature verification (X-Webhook-Signature)

Docs: https://www.wasenderapi.com/api-docs
"""

import asyncio
import hashlib
import hmac
import logging
import time
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

WASENDER_BASE = settings.wasender_base_url.rstrip("/")


# ---------------------------------------------------------------------------
# Send
# ---------------------------------------------------------------------------

async def send_whatsapp_message(phone: str, message: str) -> bool:
    """
    Send a text message via WASenderAPI.

    Args:
        phone: Recipient phone number in E.164 format (e.g. "+12345678900")
               or just digits — WASenderAPI accepts both.
        message: Plain-text message body.

    Returns:
        True on success, False on failure.
    """
    if not settings.wasender_api_key:
        logger.warning("[WASender] wasender_api_key not configured — skipping send.")
        return False

    # Ensure E.164-ish format: add + if missing
    if not phone.startswith("+"):
        phone = f"+{phone}"

    payload = {"to": phone, "text": message}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(3):
                resp = await client.post(
                    f"{WASENDER_BASE}/api/send-message",
                    headers={
                        "Authorization": f"Bearer {settings.wasender_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("success"):
                        logger.warning(
                            f"[WASender] ✓ Sent to {phone}: msgId={data.get('data', {}).get('msgId')}"
                        )
                        return True
                    else:
                        logger.error(f"[WASender] API returned success=false: {data}")
                        return False

                elif resp.status_code == 429:
                    try:
                        retry_after = int(resp.json().get("retry_after", 60))
                    except Exception:
                        retry_after = 60
                    logger.warning(
                        f"[WASender] 429 rate-limited — waiting {retry_after}s then retrying "
                        f"(attempt {attempt + 1}/3)"
                    )
                    await asyncio.sleep(retry_after + 1)

                else:
                    logger.error(
                        f"[WASender] HTTP {resp.status_code} sending to {phone}: {resp.text[:300]}"
                    )
                    return False

        logger.error(f"[WASender] Gave up after 3 attempts sending to {phone}")
        return False

    except Exception as exc:
        logger.error(f"[WASender] Exception sending to {phone}: {exc}", exc_info=True)
        return False


def send_whatsapp_message_sync(phone: str, message: str) -> bool:
    """Synchronous version for use inside Celery worker tasks."""
    if not settings.wasender_api_key:
        logger.warning("[WASender] wasender_api_key not configured — skipping send.")
        return False

    if not phone.startswith("+"):
        phone = f"+{phone}"

    payload = {"to": phone, "text": message}

    try:
        with httpx.Client(timeout=30) as client:
            for attempt in range(3):
                resp = client.post(
                    f"{WASENDER_BASE}/api/send-message",
                    headers={
                        "Authorization": f"Bearer {settings.wasender_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

                if resp.status_code == 200 and resp.json().get("success"):
                    logger.warning(f"[WASender] ✓ Sent (sync) to {phone}")
                    return True
                elif resp.status_code == 429:
                    try:
                        retry_after = int(resp.json().get("retry_after", 60))
                    except Exception:
                        retry_after = 60
                    logger.warning(
                        f"[WASender] 429 rate-limited (sync) — waiting {retry_after}s "
                        f"(attempt {attempt + 1}/3)"
                    )
                    time.sleep(retry_after + 1)
                else:
                    logger.error(f"[WASender] Sync send failed {resp.status_code}: {resp.text[:300]}")
                    return False

        logger.error(f"[WASender] Sync gave up after 3 attempts for {phone}")
        return False

    except Exception as exc:
        logger.error(f"[WASender] Sync exception for {phone}: {exc}", exc_info=True)
        return False


# ---------------------------------------------------------------------------
# Webhook helpers
# ---------------------------------------------------------------------------

def verify_signature(raw_body: bytes, signature: str) -> bool:
    """
    Verify the X-Webhook-Signature header.

    WASenderAPI supports two modes:
    1. Direct comparison — the header value equals the webhook secret
    2. HMAC-SHA256 — hex digest of the body signed with the secret

    We try both so it works regardless of which mode the dashboard uses.
    If no secret is configured, verification is skipped (dev mode).
    """
    if not settings.wasender_webhook_secret:
        logger.debug("[WASender] Webhook secret not set — skipping signature check.")
        return True

    secret = settings.wasender_webhook_secret

    # Mode 1: direct string comparison
    if hmac.compare_digest(signature, secret):
        return True

    # Mode 2: HMAC-SHA256 of raw body
    expected_hmac = hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    if hmac.compare_digest(signature, expected_hmac):
        return True

    logger.warning(
        f"[WASender] Signature mismatch. "
        f"Received: '{signature}' | "
        f"Expected direct: '{secret}' | "
        f"Expected HMAC: '{expected_hmac}'"
    )
    return False


def parse_incoming_message(body: dict) -> Optional[tuple[str, str]]:
    """
    Extract (phone, text) from a WASenderAPI webhook payload.
    Handles both list and dict formats for the messages field.
    Returns None if the event should be ignored.
    """
    import json as _json
    event = body.get("event", "")

    logger.warning(f"[WASender] RAW payload: {_json.dumps(body)[:800]}")

    if event != "messages.upsert":
        logger.warning(f"[WASender] Ignoring event type: {event!r}")
        return None

    data = body.get("data", {})
    raw_messages = data.get("messages")

    # WASenderAPI sends data.messages as a single message dict (not a list)
    if isinstance(raw_messages, dict):
        msg = raw_messages
    elif isinstance(raw_messages, list) and raw_messages:
        msg = raw_messages[0] if isinstance(raw_messages[0], dict) else None
    else:
        logger.warning(f"[WASender] No parseable messages field: {type(raw_messages)}")
        return None

    if not isinstance(msg, dict):
        return None

    key = msg.get("key", {})

    # Skip messages sent by us
    if key.get("fromMe", False):
        logger.warning(f"[WASender] Skipping fromMe=true message (our own sent message echo)")
        return None

    # Extract phone — try multiple fields in order of reliability
    phone = (
        key.get("cleanedSenderPn")
        or key.get("senderPn", "").split("@")[0]
        or key.get("remoteJid", "").split("@")[0]
        or data.get("from", "")
        or ""
    ).strip().lstrip("+")

    if not phone:
        logger.warning(f"[WASender] Could not extract phone. key={key}")
        return None

    # Extract text from multiple possible locations
    text = (
        msg.get("messageBody")
        or msg.get("text")
        or (msg.get("message") or {}).get("conversation")
        or (msg.get("message") or {}).get("extendedTextMessage", {}).get("text")
        or data.get("body")
        or data.get("text")
        or ""
    )
    if isinstance(text, str):
        text = text.strip()
    else:
        text = ""

    if not text:
        logger.warning(f"[WASender] Non-text message from {phone}, skipping.")
        return None

    return phone, text
