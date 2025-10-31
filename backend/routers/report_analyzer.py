from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..database import get_collection
from ..ml.predictor import Predictor
from ..models.report_model import MedicalReport
from ..ocr.extract_text import extract_text_from_file
from ..routers.auth import get_current_user
from ..nlp.interpret_text import interpret_text
from ..models.user_model import User


router = APIRouter()
predictor = Predictor()


@router.post("/upload")
async def upload_report(
    report_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if report_file.content_type not in {"application/pdf", "image/png", "image/jpeg"}:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    content = await report_file.read()
    try:
        extracted_text = extract_text_from_file(content, report_file.content_type) if content else ""
    except Exception as exc:  # pragma: no cover - depends on OCR libs
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {exc}") from exc

    nlp_result = interpret_text(extracted_text)
    insights = predictor.predict(extracted_text, nlp_result.key_terms)

    report_doc = {
        "user_id": str(current_user.id),
        "report_name": report_file.filename or "Medical Report",
        "extracted_text": extracted_text,
        "ai_summary": nlp_result.summary,
        "insights": insights,
        "created_at": datetime.utcnow().isoformat(),
    }

    collection = get_collection("reports")
    result = await collection.insert_one(report_doc)
    report_doc["_id"] = str(result.inserted_id)
    return MedicalReport(**report_doc)


@router.get("/", response_model=List[MedicalReport])
async def list_reports(current_user: User = Depends(get_current_user)):
    collection = get_collection("reports")
    cursor = collection.find({"user_id": current_user.id}).sort("created_at", -1)
    reports = []
    async for report in cursor:
        report["_id"] = str(report["_id"])
        reports.append(MedicalReport(**report))
    return reports
