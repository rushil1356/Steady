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

        client = Client(sid, token)
        try:
            client.messages.create(to=to, from_=sender, body=body)
            return True
        except Exception as err:  # noqa: BLE001
            if not _trial_blocked(err):
                raise
        # New Twilio trial accounts can't write their own text or choose a sender: `body` must be the NAME of one of
        # Twilio's predefined templates, sent without `from`. Upgrade the account for custom alert text.
        template = env("TWILIO_TRIAL_TEMPLATE", "sms_account_alerts")
        log.warning("Twilio trial account: sending the predefined template %r instead of the custom alert text", template)
        client.messages.create(to=to, body=template)
        return True
    except Exception:  # noqa: BLE001
        log.exception("Twilio SMS failed")
        return False


def _trial_blocked(err: Exception) -> bool:
    """True when Twilio refused a custom message because the account is still a trial (error 572006 and friends)."""
    text = str(err).lower()
    return "trial" in text and ("template" in text or "parameter" in text)


def alert_body(tier: str, summary: str) -> str:
    """The SMS text for an alert. Samarth's route can use this so every alert reads the same.
    The link opens the caregiver app straight on the Alerts tab."""
    link = f"{env('PUBLIC_BASE_URL', 'http://localhost:5173').rstrip('/')}/caregiver#alerts"
    prefix = "URGENT: " if tier == "red" else ""
    return f"{prefix}Steady: {summary} Open: {link}"
