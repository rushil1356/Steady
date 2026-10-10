"""send_sms(): Twilio. Never raises. Trial accounts can only text verified numbers.

`to` is the caregiver's phone from the profile. CAREGIVER_PHONE in .env is only a fallback for an empty profile."""

from __future__ import annotations

from app.ai._env import env, log, use_mocks


def send_sms(to: str, body: str) -> bool:
    body = " ".join(body.split())[:600]
    if use_mocks():
        log.info("[mock SMS to %s] %s", to, body)
        return True

    sid, token, sender = env("TWILIO_ACCOUNT_SID"), env("TWILIO_AUTH_TOKEN"), env("TWILIO_FROM_NUMBER")
    to = (to or env("CAREGIVER_PHONE")).strip()
    if not (sid and token and sender and to):
        log.warning("SMS not sent: Twilio settings or the caregiver number are missing")
        return False
    try:
        from twilio.rest import Client

        Client(sid, token).messages.create(to=to, from_=sender, body=body)
        return True
    except Exception:  # noqa: BLE001
        log.exception("Twilio SMS failed")
        return False


def alert_body(tier: str, summary: str) -> str:
    """The SMS text for an alert. Samarth's route can use this so every alert reads the same.
    The link opens the caregiver app straight on the Alerts tab."""
    link = f"{env('PUBLIC_BASE_URL', 'http://localhost:5173').rstrip('/')}/caregiver#alerts"
    prefix = "URGENT: " if tier == "red" else ""
    return f"{prefix}Steady: {summary} Open: {link}"
