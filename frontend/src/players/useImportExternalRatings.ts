import { useQueryClient } from "@tanstack/react-query";
import { $api, endpointKey } from "@/client/api";

/**
 * Import rating snapshots from an external source.
 *
 * Its own hook rather than part of `usePlayers`: it belongs to the `/external/`
 * router and is called from both the player list and the player detail page.
 * A successful import changes the ratings nested in player responses, so both
 * player caches are invalidated.
 */
export function useImportExternalRatings() {
  const queryClient = useQueryClient();

  return $api.useMutation("post", "/external/{source}/import/", {
    meta: { successMessage: "notifications.ratingsImported" },
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
