from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    jwt_secret_key: str
    allowed_origins: list[str] = []
    database_fp: str = "database.db"


settings = Settings()  # type: ignore[call-arg]
