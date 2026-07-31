import { components } from "@client/schema";

type ExternalRatingSource = components["schemas"]["ExternalRatingSource"];
type ExternalRatingPublic = components["schemas"]["ExternalRatingPublic"];
type PlayerExternalIdPublic = components["schemas"]["PlayerExternalIdPublic"];

/** Any player response that carries external ids: `PlayerPublic` or `PlayerDetail`. */
type PlayerWithExternalIds = { external_ids: PlayerExternalIdPublic[] };

/** The public FIDE profile of a player, by their FIDE id. */
export const fideProfileUrl = (fideId: string) =>
  `https://ratings.fide.com/profile/${fideId}`;

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
