from typing import Literal

from pydantic import SecretStr
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
    # Page on the club website that embeds the Google Sheet members sign up in.
    club_registration_url: str = "https://paulkeres.nl/?page_id=22537"
    # The club website's WordPress, which rounds are published to. Publishing
    # needs a WordPress user and an application password for it (Users ->
    # Profile -> Application Passwords); unset means no publishing at all.
    club_site_base_url: str = "https://paulkeres.nl"
    club_site_username: str | None = None
    club_site_app_password: SecretStr | None = None
    # The status a round's post is created with. "draft" is for trying out
    # publishing without anything going live; an existing post keeps whatever
    # status it has on the site.
    club_site_post_status: Literal["publish", "draft"] = "publish"


settings = Settings()  # type: ignore[call-arg]
