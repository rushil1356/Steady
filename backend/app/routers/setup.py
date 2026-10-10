from fastapi import APIRouter, File, UploadFile

from app import mocks
from app.contracts import ConfirmRequest, ConfirmResponse, ExtractResponse, LanguagesResponse

router = APIRouter(prefix="/api")


@router.post("/setup/extract", response_model=ExtractResponse)
async def extract(images: list[UploadFile] = File(...)):
    return ExtractResponse.model_validate(mocks.load("extracted_meds"))


@router.get("/languages", response_model=LanguagesResponse)
def languages():
    return LanguagesResponse.model_validate(mocks.load("languages"))


@router.post("/setup/confirm", response_model=ConfirmResponse)
def confirm(body: ConfirmRequest):
    return ConfirmResponse.model_validate(mocks.load("setup_confirm"))
