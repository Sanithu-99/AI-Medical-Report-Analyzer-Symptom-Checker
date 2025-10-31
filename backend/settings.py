from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import EmailStr, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
    )

    mongo_uri: str = Field(..., env="MONGO_URI")
    mongo_db_name: str = Field("medical_analyzer", env="MONGO_DB_NAME")
    openai_api_key: str | None = Field(default=None, env="OPENAI_API_KEY")
    secret_key: str = Field(..., env="SECRET_KEY")
    cors_origins: List[str] | str = Field(default="http://localhost:3000", env="CORS_ORIGINS")
    default_user_email: EmailStr | None = Field(default=None, env="DEFAULT_USER_EMAIL")
    default_user_password: str | None = Field(default=None, env="DEFAULT_USER_PASSWORD")

    @field_validator("cors_origins", mode="after")
    @classmethod
    def ensure_cors_list(cls, value: List[str] | str | None) -> List[str]:
        if not value:
            return ["http://localhost:3000"]
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
