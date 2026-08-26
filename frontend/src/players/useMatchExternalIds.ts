import { useQueryClient } from "@tanstack/react-query";
import { $api, endpointKey } from "@/client/api";

/**
 * Find the external ids of players by searching a source for their names.
 *
 * Its own hook rather than part of `usePlayers`: it belongs to the `/external/`
 * router, like `useImportExternalRatings`. A run attaches external ids to
 * players, so both player caches are invalidated.
 */
export function useMatchExternalIds() {
  const queryClient = useQueryClient();

  // `silent`: `MatchExternalIdsModal` renders the failure itself, beside the
  // run's own summary of what it matched.
  return $api.useMutation("post", "/external/{source}/match/", {
    meta: {
      silent: true,
      successMessage: "notifications.externalIdsMatched",
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: endpointKey("get", "/players/"),
      });
      queryClient.invalidateQueries({
        queryKey: endpointKey("get", "/players/{id}/"),
      });
    },
  });
}
