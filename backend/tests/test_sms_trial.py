"""send_sms falls back to a predefined template when a Twilio trial account refuses custom text."""

import sys
import types

from app.voice import sms


class _Trial(Exception):
    pass


def _fake_twilio(calls, fail_first):
    class Messages:
        def create(self, **kw):
            calls.append(kw)
            if fail_first and not kw["body"].startswith("sms_"):
                raise _Trial("Invalid template name. Trial accounts can only use predefined SMS templates.")

    class Client:
        def __init__(self, *a):
            self.messages = Messages()

    mod = types.ModuleType("twilio.rest")
    mod.Client = Client
    return mod


def _setup(monkeypatch, calls, fail_first):
    monkeypatch.setenv("USE_MOCKS", "0")
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACx")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "t")
    monkeypatch.setenv("TWILIO_FROM_NUMBER", "+15550001111")
    monkeypatch.setitem(sys.modules, "twilio", types.ModuleType("twilio"))
    monkeypatch.setitem(sys.modules, "twilio.rest", _fake_twilio(calls, fail_first))


def test_custom_text_goes_through_on_a_full_account(monkeypatch):
    calls = []
    _setup(monkeypatch, calls, fail_first=False)
    assert sms.send_sms("+15550002222", "Steady: hello") is True
    assert len(calls) == 1 and calls[0]["body"] == "Steady: hello" and calls[0]["from_"] == "+15550001111"


def test_trial_account_falls_back_to_a_template(monkeypatch):
    calls = []
    _setup(monkeypatch, calls, fail_first=True)
    assert sms.send_sms("+15550002222", "Steady: hello") is True
    assert len(calls) == 2
    assert calls[1] == {"to": "+15550002222", "from_": "+15550001111", "body": "sms_account_alerts"}


def test_other_errors_still_fail(monkeypatch):
    calls = []
    _setup(monkeypatch, calls, fail_first=False)
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "")
    assert sms.send_sms("+15550002222", "x") is False
