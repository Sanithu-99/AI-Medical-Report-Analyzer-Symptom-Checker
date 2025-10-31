from functools import lru_cache
from typing import List

from pydantic import EmailStr, Field, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_uri: str = Field(..., env="MONGO_URI")
    mongo_db_name: str = Field("medical_analyzer", env="MONGO_DB_NAME")
    openai_api_key: str | None = Field(default=None, env="OPENAI_API_KEY")
    secret_key: str = Field(..., env="SECRET_KEY")
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    default_user_email: EmailStr | None = Field(default=None, env="DEFAULT_USER_EMAIL")
    default_user_password: str | None = Field(default=None, env="DEFAULT_USER_PASSWORD")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @validator("cors_origins", pre=True)
    def split_cors_origins(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
