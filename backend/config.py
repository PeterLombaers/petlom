from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    jwt_secret_key: str
    allowed_origins: list[str]


settings = Settings()  # type: ignore[call-arg]
