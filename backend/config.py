from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    jwt_secret_key: str
    allowed_origins: list[str] = []
    database_fp: str = "database.db"
    # Base URL of the chess_player_db instance serving external ratings. One
    # service covers every source, so there is one setting rather than one per
    # federation. Unset means no external ratings at all.
    chess_db_api_base_url: str | None = None


settings = Settings()  # type: ignore[call-arg]
