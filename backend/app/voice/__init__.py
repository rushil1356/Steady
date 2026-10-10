"""Steady's voice layer (ElevenLabs speech, Twilio SMS). Owner: Rushil.

Samarth's routes call ONLY these functions. Signatures are part of the contract: keep them stable.
With USE_MOCKS=1 nothing calls an API. None of them raise on API failure.
"""

from .sms import alert_body, send_sms
from .stt import transcribe
from .tts import say

__all__ = ["say", "transcribe", "send_sms", "alert_body"]
