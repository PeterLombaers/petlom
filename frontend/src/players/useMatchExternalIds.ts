import { useQueryClient } from "@tanstack/react-query";
import { $api, endpointKey, formatHTTPValidationError } from "@/client/api";
import { components } from "@/client/schema";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];

/**
 * Find the external ids of players by searching a source for their names.
 *
 * Its own hook rather than part of `usePlayers`: it belongs to the `/external/`
 * router, like `useImportExternalRatings`. A run attaches external ids to
 * players, so both player caches are invalidated.
 */
export function useMatchExternalIds() {
  const queryClient = useQueryClient();

  return $api.useMutation("post", "/external/{source}/match/", {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: endpointKey("get", "/players/"),
      });
      queryClient.invalidateQueries({
        queryKey: endpointKey("get", "/players/{id}/"),
      });
    },
    onError: (error: HTTPValidationError) => {
      console.error(formatHTTPValidationError(error));
    },
  });
}
