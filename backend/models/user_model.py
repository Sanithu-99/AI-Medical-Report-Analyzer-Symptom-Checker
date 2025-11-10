from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    email: EmailStr
    password_hash: str
    created_at: str
    role: str = "user"  # user | clinician | admin
    plan: str = "individual"
    plan_expiry: str | None = None
    mfa_enabled: bool = False
    totp_secret: str | None = None
    last_login_at: str | None = None
    last_login_ip: str | None = None

    @field_validator("id", mode="before")
    @classmethod
    def ensure_string_id(cls, value):
        if value is None:
            return value
        return str(value)
