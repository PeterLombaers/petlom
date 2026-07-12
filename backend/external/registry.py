from backend.config import settings
from backend.enums import ExternalRatingSource
from backend.external.base import ExternalRatingProvider, ProviderNotConfiguredError
from backend.external.fide import FideProvider


def get_provider(source: ExternalRatingSource) -> ExternalRatingProvider:
    if source == ExternalRatingSource.FIDE:
        if not settings.fide_api_base_url:
            raise ProviderNotConfiguredError("FIDE_API_BASE_URL is not configured")
        return FideProvider(settings.fide_api_base_url, settings.fide_api_settings_url)
    raise ProviderNotConfiguredError(f"No provider available for source '{source}'")
