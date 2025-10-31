from typing import List

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MedicalReport(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    user_id: str
    report_name: str
    extracted_text: str
    ai_summary: str
    insights: List[str]
    created_at: str

    @field_validator("id", mode="before")
    @classmethod
    def ensure_string_id(cls, value):
        if value is None:
            return value
        return str(value)
