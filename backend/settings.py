from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import EmailStr, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    """
    Centralised configuration with HIPAA/SOC2 aware defaults.
    NOTE: All secrets must be sourced from a vault/KMS in production.
    """

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
    )

    mongo_uri: str = Field(..., env="MONGO_URI")
    mongo_db_name: str = Field("medical_analyzer", env="MONGO_DB_NAME")
    openai_api_key: str | None = Field(default=None, env="OPENAI_API_KEY")
    llm_provider: str = Field("ollama", env="LLM_PROVIDER")
    ollama_url: str = Field("http://127.0.0.1:11434", env="OLLAMA_URL")
    vertex_model: str | None = Field(default=None, env="VERTEX_MODEL_NAME")
    secret_key: str = Field(..., env="SECRET_KEY")
    jwt_secret: str | None = Field(default=None, env="JWT_SECRET")
    encryption_key: str = Field(..., env="ENCRYPTION_KEY")
    kms_project_id: str | None = Field(default=None, env="KMS_PROJECT_ID")
    vpn_api_key: str | None = Field(default=None, env="VPN_API_KEY")
    vpn_provider_url: str = Field("https://ipinfo.io", env="VPN_PROVIDER_URL")
    cors_origins: List[str] | str = Field(default="http://localhost:3000", env="CORS_ORIGINS")
    default_user_email: EmailStr | None = Field(default=None, env="DEFAULT_USER_EMAIL")
    default_user_password: str | None = Field(default=None, env="DEFAULT_USER_PASSWORD")
    https_only: bool = Field(True, env="HTTPS_ONLY")
    hsts_max_age: int = Field(63072000, env="HSTS_MAX_AGE")
    allowed_countries: List[str] | str = Field(default="US,CA,GB", env="ALLOWED_COUNTRIES")
    restricted_countries: List[str] | str = Field(default="CN,RU", env="RESTRICTED_COUNTRIES")
    geo_enforcement: bool = Field(True, env="GEO_ENFORCEMENT")
    access_token_ttl_minutes: int = Field(15, env="ACCESS_TOKEN_TTL_MINUTES")
    refresh_token_ttl_hours: int = Field(24 * 7, env="REFRESH_TOKEN_TTL_HOURS")
    session_reauth_ip_change_pct: float = Field(0.45, env="SESSION_REAUTH_IP_CHANGE_PCT")
    audit_log_collection: str = Field("audit_logs", env="AUDIT_LOG_COLLECTION")
    session_log_collection: str = Field("session_log", env="SESSION_LOG_COLLECTION")
    data_retention_days: int = Field(365, env="DATA_RETENTION_DAYS")
    soft_delete_grace_days: int = Field(30, env="SOFT_DELETE_GRACE_DAYS")

    @field_validator("cors_origins", mode="after")
    @classmethod
    def ensure_list(cls, value: List[str] | str | None) -> List[str]:
        if not value:
            return ["http://localhost:3000"]
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("allowed_countries", "restricted_countries", mode="after")
    @classmethod
    def ensure_country_list(cls, value: List[str] | str | None) -> List[str]:
        if not value:
            return []
        if isinstance(value, str):
            return [item.strip().upper() for item in value.split(",") if item.strip()]
        return [item.strip().upper() for item in value]

    @field_validator("default_user_email", mode="before")
    @classmethod
    def empty_string_to_none(cls, value: str | None) -> EmailStr | None:
        if value == "":
            return None
        return value

    @model_validator(mode="after")
    def ensure_jwt_secret(self) -> "Settings":
        if not self.jwt_secret:
            self.jwt_secret = self.secret_key
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
