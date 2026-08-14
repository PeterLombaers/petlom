from backend.config import settings
from backend.enums import ExternalRatingSource
from backend.external.base import ExternalRatingProvider, ProviderNotConfiguredError
from backend.external.chess_db import ChessDbProvider


def get_provider(source: ExternalRatingSource) -> ExternalRatingProvider:
    """The client for a source.

    Every source is served by the same rating database, so this only checks
    that one is configured. Whether it actually holds data for this source is
    only known once it answers, and surfaces as a ProviderNotConfiguredError
    from the call itself.
    """
    if not settings.chess_db_api_base_url:
        raise ProviderNotConfiguredError("CHESS_DB_API_BASE_URL is not configured")
    return ChessDbProvider(settings.chess_db_api_base_url, source)
