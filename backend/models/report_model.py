from typing import List

from pydantic import BaseModel, Field, validator


class MedicalReport(BaseModel):
    id: str | None = Field(default=None, alias="_id")
    user_id: str
    report_name: str
    extracted_text: str
    ai_summary: str
    insights: List[str]
    created_at: str

    class Config:
        allow_population_by_field_name = True

    @validator("id", pre=True, always=True)
    def ensure_string_id(cls, value):
        if value is None:
            return value
        return str(value)
