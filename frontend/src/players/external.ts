import { components } from "@client/schema";

type ExternalRatingSource = components["schemas"]["ExternalRatingSource"];
type ExternalRatingPublic = components["schemas"]["ExternalRatingPublic"];
type PlayerExternalIdPublic = components["schemas"]["PlayerExternalIdPublic"];

/** Any player response that carries external ids: `PlayerPublic` or `PlayerDetail`. */
type PlayerWithExternalIds = { external_ids: PlayerExternalIdPublic[] };

/**
 * Every rating source, in the order the UI offers them.
 *
 * Typed against the schema enum, so a source added to the backend is a compile
 * error here until the frontend knows what to call it and where it links to.
 */
export const EXTERNAL_SOURCES = [
  "fide",
  "knsb",
] as const satisfies readonly ExternalRatingSource[];

/** The public profile page of a player at each source, where there is one. */
const PROFILE_URLS: Record<
  ExternalRatingSource,
  ((externalId: string) => string) | null
> = {
  fide: (externalId) => `https://ratings.fide.com/profile/${externalId}`,
  // The KNSB publishes no stable per-player page.
  knsb: null,
};

/** Where to link a player's id at `source`, or `null` when it links nowhere. */
export function externalProfileUrl(
  source: ExternalRatingSource,
  externalId: string,
): string | null {
  return PROFILE_URLS[source]?.(externalId) ?? null;
}

/** The player's id at `source`, or `null` when they have none. */
export function getExternalId(
  player: PlayerWithExternalIds,
  source: ExternalRatingSource,
): string | null {
  return (
    player.external_ids.find((e) => e.source === source)?.external_id ?? null
  );
}

/**
 * The player's rating snapshot at `source`, or `null`.
 *
 * Which snapshot this is depends on the `list_date` of the request that
 * returned the player: the newest one at or before that date, or the newest
 * overall when no date was given.
 */
export function getRating(
  player: PlayerWithExternalIds,
  source: ExternalRatingSource,
): ExternalRatingPublic | null {
  return player.external_ids.find((e) => e.source === source)?.rating ?? null;
}
