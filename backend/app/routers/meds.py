"""'Know more' about a medicine: openFDA label, rewritten simply by Gemini, read aloud. Owner: Rushil."""

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app import ai, care_store, voice
from app.contracts import MedInfo

router = APIRouter(prefix="/api")


@router.get("/meds/{med_id}/info", response_model=MedInfo)
async def med_info(med_id: str):
    med = care_store.med(med_id)
    name = med.name if med else med_id.removeprefix("med_").replace("_", " ").title()
    info = await run_in_threadpool(ai.simplify_label, name)
    lang = care_store.profile().patient.language
    spoken = await run_in_threadpool(voice.say, f"{info.what_for} {info.how_to_take}", lang)
    return info.model_copy(update={"spoken": spoken})
