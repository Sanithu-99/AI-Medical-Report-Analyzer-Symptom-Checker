from collections import Counter
from datetime import datetime, timezone
from typing import List

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from ..ai.healthscore_engine import healthscore_engine
from ..database import get_collection
from ..ml.predictor import Predictor
from ..models.report_model import MedicalReport
from ..models.user_model import User
from ..nlp.interpret_text import interpret_text
from ..ocr.extract_text import extract_text_from_file
from ..routers.auth import get_current_user
from ..services.anonymization_service import anonymization_service
from ..services.diagnosis_service import DiagnosisEngine
from ..services.health_advice_service import HealthAdviceEngine
from ..services.storage_service import storage_service
from ..services.subscription_service import subscription_service


router = APIRouter()
predictor = Predictor()
diagnosis_engine = DiagnosisEngine(predictor)
health_advice_engine = HealthAdviceEngine()


class DiagnosisCandidateModel(BaseModel):
    condition: str
    confidence: float
    confidence_label: str


class DiagnosisResponse(BaseModel):
    has_data: bool
    generated_at: str | None
    report_count: int
    primary_condition: str | None
    primary_confidence: float | None
    primary_confidence_label: str | None
    confidence_met_threshold: bool
    confidence_threshold: float
    summary: str
    supporting_evidence: List[str]
    differentials: List[DiagnosisCandidateModel]
    caution: str | None
    disclaimer: str


class AdviceItemModel(BaseModel):
    title: str
    description: str
    actions: List[str]
    matched_keywords: List[str]


class AdviceResponse(BaseModel):
    has_data: bool
    generated_at: str | None
    report_count: int
    summary: str
    advice: List[AdviceItemModel]
    supporting_evidence: List[str]
    disclaimer: str


def _increment(counter: Counter, key: str | None) -> None:
    if key:
        counter[key] += 1


@router.post("/upload")
async def upload_report(
    report_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    await subscription_service.assert_report_quota(current_user.id, current_user.plan)
    if report_file.content_type not in {"application/pdf", "image/png", "image/jpeg"}:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    content = await report_file.read()
    try:
        extracted_text = extract_text_from_file(content, report_file.content_type) if content else ""
    except Exception as exc:  # pragma: no cover - depends on OCR libs
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {exc}") from exc

    anonymized = await anonymization_service.anonymize(
        extracted_text,
        {"report_name": report_file.filename or "Report"},
        current_user.id,
    )
    nlp_result = interpret_text(anonymized.sanitized_text)
    insights = predictor.predict(anonymized.sanitized_text, nlp_result.key_terms)

    now = datetime.now(timezone.utc).isoformat()
    report_doc = {
        "user_id": str(current_user.id),
        "report_name": report_file.filename or "Medical Report",
        "extracted_text": anonymized.sanitized_text,
        "ai_summary": nlp_result.summary,
        "insights": insights,
        "phi_mapping_id": anonymized.mapping_id,
        "quasi_identifiers": anonymized.quasi_identifiers,
        "storage_state": "active",
        "created_at": now,
    }

    collection = get_collection("reports")
    result = await collection.insert_one(report_doc)
    await subscription_service.increment_usage(current_user.id, "reports")
    report_doc["_id"] = str(result.inserted_id)
    return MedicalReport(**report_doc)


@router.get("/", response_model=List[MedicalReport])
async def list_reports(current_user: User = Depends(get_current_user)):
    collection = get_collection("reports")
    cursor = (
        collection.find({"user_id": current_user.id, "storage_state": {"$ne": "pending_purge"}})
        .sort("created_at", -1)
    )
    reports = []
    async for report in cursor:
        report["_id"] = str(report["_id"])
        reports.append(MedicalReport(**report))
    return reports


@router.delete("/{report_id}")
async def delete_report(report_id: str, current_user: User = Depends(get_current_user)):
    try:
        object_id = ObjectId(report_id)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid report identifier.") from exc

    collection = get_collection("reports")
    result = await collection.update_one(
        {"_id": object_id, "user_id": current_user.id},
        {"$set": {"storage_state": "pending_purge", "deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"detail": "Report scheduled for deletion."}


@router.delete("/")
async def delete_all_reports(current_user: User = Depends(get_current_user)):
    collection = get_collection("reports")
    result = await collection.update_many(
        {"user_id": current_user.id},
        {"$set": {"storage_state": "pending_purge", "deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"deleted": result.modified_count}


@router.get("/diagnosis", response_model=DiagnosisResponse)
async def generate_diagnosis(current_user: User = Depends(get_current_user)) -> DiagnosisResponse:
    collection = get_collection("reports")
    cursor = collection.find({"user_id": current_user.id}).sort("created_at", -1)
    reports: List[MedicalReport] = []
    async for report in cursor:
        report["_id"] = str(report["_id"])
        reports.append(MedicalReport(**report))

    payload = diagnosis_engine.generate(reports)
    return DiagnosisResponse(**payload)


@router.get("/advice", response_model=AdviceResponse)
async def generate_health_advice(current_user: User = Depends(get_current_user)) -> AdviceResponse:
    collection = get_collection("reports")
    cursor = collection.find({"user_id": current_user.id}).sort("created_at", -1)
    reports: List[MedicalReport] = []
    async for report in cursor:
        report["_id"] = str(report["_id"])
        reports.append(MedicalReport(**report))

    payload = health_advice_engine.generate(reports)
    return AdviceResponse(**payload)


@router.get("/healthscore")
async def healthscore(current_user: User = Depends(get_current_user)):
    collection = get_collection("reports")
    cursor = collection.find({"user_id": current_user.id, "storage_state": {"$ne": "pending_purge"}}).sort("created_at", -1)
    reports: List[MedicalReport] = []
    async for report in cursor:
        report["_id"] = str(report["_id"])
        reports.append(MedicalReport(**report))
    payload = await healthscore_engine.score(reports, current_user.plan)
    return payload


@router.get("/analytics/overview")
async def analytics_overview(current_user: User = Depends(get_current_user)):
    if current_user.plan != "institution" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Institution plan required for analytics.")

    collection = get_collection("reports")
    cursor = (
        collection.find({"user_id": current_user.id, "storage_state": {"$ne": "pending_purge"}})
        .sort("created_at", -1)
    )
    report_count = 0
    timeline_counter: Counter[str] = Counter()
    risk_counter: Counter[str] = Counter()
    age_counter: Counter[str] = Counter()
    region_counter: Counter[str] = Counter()
    gender_counter: Counter[str] = Counter()
    recent_reports: List[dict] = []

    async for report in cursor:
        report_count += 1
        created_at = report.get("created_at")
        if created_at:
            timeline_counter[created_at[:10]] += 1
        qi = report.get("quasi_identifiers") or {}
        _increment(age_counter, qi.get("age_bucket"))
        _increment(region_counter, qi.get("region"))
        _increment(gender_counter, qi.get("gender"))

        for insight in report.get("insights") or []:
            if isinstance(insight, str):
                label = insight.split(":")[0].strip().lower()
                if label:
                    risk_counter[label] += 1

        if len(recent_reports) < 5:
            report["_id"] = str(report["_id"])
            recent_reports.append(
                {
                    "id": report["_id"],
                    "report_name": report.get("report_name"),
                    "created_at": created_at,
                    "summary": (report.get("ai_summary") or "")[:280],
                }
            )

    return {
        "report_count": report_count,
        "risk_terms": [{"term": term, "count": count} for term, count in risk_counter.most_common(8)],
        "timeline": [{"date": date, "count": count} for date, count in sorted(timeline_counter.items())],
        "quasi_identifiers": {
            "age_buckets": [{"label": key, "count": count} for key, count in age_counter.items()],
            "regions": [{"label": key, "count": count} for key, count in region_counter.items()],
            "gender": [{"label": key, "count": count} for key, count in gender_counter.items()],
        },
        "recent_reports": recent_reports,
    }


@router.get("/{report_id}/signed-url")
async def create_signed_download(report_id: str, current_user: User = Depends(get_current_user)):
    collection = get_collection("reports")
    try:
        object_id = ObjectId(report_id)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid report identifier.") from exc
    exists = await collection.find_one(
        {"_id": object_id, "user_id": current_user.id, "storage_state": {"$ne": "pending_purge"}}
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Report not found.")
    token = storage_service.create_token(report_id, current_user.id)
    return {
        "url": f"/api/reports/{report_id}/download?token={token}",
        "expires_in": 600,
    }


@router.get("/{report_id}/download")
async def download_report(report_id: str, token: str, current_user: User = Depends(get_current_user)):
    storage_service.verify_token(token, report_id, current_user.id)
    collection = get_collection("reports")
    try:
        object_id = ObjectId(report_id)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid report identifier.") from exc
    report = await collection.find_one(
        {"_id": object_id, "user_id": current_user.id, "storage_state": {"$ne": "pending_purge"}}
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return PlainTextResponse(report.get("extracted_text", ""), headers={"Content-Type": "text/plain; charset=utf-8"})
