from __future__ import annotations

from bson import ObjectId
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict

from fastapi import HTTPException, status

from ..database import get_collection


@dataclass(frozen=True)
class PlanLimits:
    name: str
    monthly_reports: int | None
    symptom_checks: int | None
    features: Dict[str, bool]


PLAN_MATRIX: Dict[str, PlanLimits] = {
    "individual": PlanLimits(
        name="Individual",
        monthly_reports=10,
        symptom_checks=20,
        features={
            "advanced_analytics": False,
            "exports": False,
            "api_access": False,
        },
    ),
    "clinician": PlanLimits(
        name="Clinician",
        monthly_reports=100,
        symptom_checks=250,
        features={
            "advanced_analytics": True,
            "exports": True,
            "api_access": False,
        },
    ),
    "institution": PlanLimits(
        name="Institution",
        monthly_reports=None,
        symptom_checks=None,
        features={
            "advanced_analytics": True,
            "exports": True,
            "api_access": True,
        },
    ),
}


class SubscriptionService:
    def __init__(self) -> None:
        self.usage_collection_name = "plan_usage"
        self.user_collection_name = "users"

    def _usage_collection(self):
        return get_collection(self.usage_collection_name)

    def _user_collection(self):
        return get_collection(self.user_collection_name)

    @staticmethod
    def normalize_plan(plan: str | None) -> str:
        if not plan:
            return "individual"
        plan_key = plan.lower()
        if plan_key not in PLAN_MATRIX:
            return "individual"
        return plan_key

    def get_limits(self, plan: str | None) -> PlanLimits:
        return PLAN_MATRIX[self.normalize_plan(plan)]

    async def assert_report_quota(self, user_id: str, plan: str | None) -> None:
        limits = self.get_limits(plan)
        if limits.monthly_reports is None:
            return
        count = await self._get_monthly_usage(user_id, "reports")
        if count >= limits.monthly_reports:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Plan limit reached. Upgrade to Clinician or Institution for higher quotas.",
            )

    async def assert_symptom_quota(self, user_id: str, plan: str | None) -> None:
        limits = self.get_limits(plan)
        if limits.symptom_checks is None:
            return
        count = await self._get_monthly_usage(user_id, "symptom_checks")
        if count >= limits.symptom_checks:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Monthly symptom checker quota exceeded for your plan.",
            )

    async def increment_usage(self, user_id: str, metric: str) -> None:
        month_key = datetime.now(timezone.utc).strftime("%Y-%m")
        await self._usage_collection().update_one(
            {"user_id": user_id, "month": month_key},
            {"$inc": {metric: 1}},
            upsert=True,
        )

    async def _get_monthly_usage(self, user_id: str, metric: str) -> int:
        month_key = datetime.now(timezone.utc).strftime("%Y-%m")
        doc = await self._usage_collection().find_one({"user_id": user_id, "month": month_key})
        return int(doc.get(metric, 0)) if doc else 0

    async def update_plan(self, user_id: str, plan: str, duration_days: int) -> Dict[str, str]:
        plan_key = self.normalize_plan(plan)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=duration_days)).isoformat()
        await self._user_collection().update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"plan": plan_key, "plan_expiry": expires_at}},
        )
        return {"plan": plan_key, "plan_expiry": expires_at}


subscription_service = SubscriptionService()
