from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    email: EmailStr
    password_hash: str
    created_at: str

    @field_validator("id", mode="before")
    @classmethod
    def ensure_string_id(cls, value):
        if value is None:
            return value
        return str(value)
