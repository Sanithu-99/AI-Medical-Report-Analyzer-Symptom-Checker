from pydantic import BaseModel, EmailStr, Field, validator


class User(BaseModel):
    id: str | None = Field(default=None, alias="_id")
    email: EmailStr
    password_hash: str
    created_at: str

    class Config:
        allow_population_by_field_name = True

    @validator("id", pre=True, always=True)
    def ensure_string_id(cls, value):
        if value is None:
            return value
        return str(value)
