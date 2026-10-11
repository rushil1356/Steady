from fastapi import APIRouter, File, UploadFile
from fastapi.concurrency import run_in_threadpool

from app import ai, mocks
from app.contracts import ConfirmRequest, ConfirmResponse, ExtractResponse, LanguagesResponse

router = APIRouter(prefix="/api")


@router.post("/setup/extract", response_model=ExtractResponse)
async def extract(images: list[UploadFile] = File(...)):
    # Rushil: Gemini reads the label photos from the caregiver's phone. [] means nothing readable -> add by hand.
    photos = [await image.read() for image in images[:6]]
    return ExtractResponse(medications=await run_in_threadpool(ai.extract_schedule, photos))


@router.get("/languages", response_model=LanguagesResponse)
def languages():
    return LanguagesResponse(languages=ai.list_languages())


@router.post("/setup/confirm", response_model=ConfirmResponse)
def confirm(body: ConfirmRequest):
    return ConfirmResponse.model_validate(mocks.load("setup_confirm"))
