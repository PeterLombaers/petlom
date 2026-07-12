from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    jwt_secret_key: str
    allowed_origins: list[str] = []
    database_fp: str = "database.db"
    fide_api_base_url: str | None = None
    fide_api_settings_url: str | None = None


settings = Settings()  # type: ignore[call-arg]
