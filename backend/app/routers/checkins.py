"""Check-ins: question -> the patient's answer (voice or text) -> Gemini analysis -> silent alert + warm reply.
Owner: Rushil (wires the AI and voice layer into the API)."""

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app import ai, care_store, voice
from app.contracts import Analysis, AlertRef, CheckinPrompt, CheckinResult, CheckinTextBody
from app.prompts import CHECKIN_QUESTION

router = APIRouter(prefix="/api")


@router.get("/checkins/prompt", response_model=CheckinPrompt)
def prompt():
    patient = care_store.profile().patient
    part = care_store.part_of_day()
    opener = ai.write_opener(patient.interests, part)
    return CheckinPrompt(
        opener=voice.say(opener, patient.language) if opener else None,
        question=voice.say(CHECKIN_QUESTION[part], patient.language),
    )


def _alert_title(a: Analysis) -> str:
    reason = (a.why[0] if a.why else (a.red_flags[0] if a.red_flags else "Check-in needs a look")).rstrip(".")
    reason = reason[0].upper() + reason[1:]
    return f"Urgent: {reason}" if a.suggested_tier == "red" else reason


async def _read_answer(request: Request) -> tuple[str, bytes | None, str]:
    """Multipart field 'audio' (a phone recording) or JSON {"text": "..."}. Returns (text, audio, mime)."""
    if request.headers.get("content-type", "").startswith("multipart/"):
        form = await request.form()
        upload = form.get("audio")
        text = form.get("text") if isinstance(form.get("text"), str) else ""
        if upload is not None and hasattr(upload, "read"):
            return text, await upload.read(), (upload.content_type or "audio/webm")
        return text, None, ""
    try:
        return CheckinTextBody.model_validate(await request.json()).text, None, ""
    except Exception as err:  # noqa: BLE001
        raise HTTPException(422, 'Send multipart field "audio" or JSON {"text": "..."}') from err


@router.post("/checkins", response_model=CheckinResult)
async def create_checkin(request: Request):
    text, audio, mime = await _read_answer(request)
    prof = care_store.profile()
    lang = prof.patient.language
    if audio:
        text = await run_in_threadpool(voice.transcribe, audio, mime, lang)
    if not (text or "").strip():
        raise HTTPException(422, "Steady couldn't hear that. Please try again, or type your answer.")

    part = care_store.part_of_day()
    analysis = await run_in_threadpool(
        ai.analyze_checkin, text, care_store.meds(), care_store.history(), audio,
        prof.patient.preferred_name, lang, part, prof.caregiver.name,
    )
    tier = analysis.suggested_tier
    record = care_store.add_checkin({
        "transcript": text, "transcript_en": analysis.transcript_en, "lang": lang, "tier": tier,
        "symptoms": analysis.symptoms, "red_flags": analysis.red_flags, "mood_score": analysis.mood_score,
        "tone_note": analysis.tone_note, "why": analysis.why, "heard_audio": analysis.heard_audio,
        "summary": analysis.caregiver_summary,
    })

    # Silent alert: the caregiver is told, the patient is not (their reply never mentions it).
    alert = None
    if tier != "green" and prof.sharing_consent:
        title = _alert_title(analysis)
        sent = await run_in_threadpool(voice.send_sms, prof.caregiver.phone,
                                       voice.alert_body(tier, analysis.caregiver_summary))
        saved = care_store.add_alert({
            "tier": tier, "title": title, "summary": analysis.caregiver_summary, "note": None, "sms_sent": sent,
            "why": analysis.why, "tone_note": analysis.tone_note, "checkin_id": record["id"],
        })
        alert = AlertRef(id=saved["id"], tier=tier, title=title, sms_sent=sent)

    reply = await run_in_threadpool(voice.say, analysis.patient_reply_en, lang)
    return CheckinResult(checkin_id=record["id"], transcript=text, analysis=analysis, tier=tier,
                         alert=alert, reply=reply)
