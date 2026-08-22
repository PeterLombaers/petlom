import { $api, endpointKey, formatHTTPValidationError } from "@/client/api";
import { components } from "@/client/schema";
import { useQueryClient } from "@tanstack/react-query";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];

/** A single player with their external ids and competition ratings. */
export function usePlayer(id: number) {
  return $api.useQuery("get", "/players/{id}/", {
    params: { path: { id } },
  });
}

export function usePlayers() {
  const {
    data: players,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/players/");

  const queryClient = useQueryClient();
  const onSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: endpointKey("get", "/players/"),
    });
    queryClient.invalidateQueries({
      queryKey: endpointKey("get", "/players/{id}/"),
    });
  };
  const onError = (error: HTTPValidationError) => {
    const errorMessage = formatHTTPValidationError(error);
    console.error(errorMessage);
  };

  const createMutation = $api.useMutation("post", "/players/", {
    onSuccess,
    onError,
  });

  const editMutation = $api.useMutation("patch", "/players/{id}/", {
    onSuccess,
    onError,
  });

  const deleteMutation = $api.useMutation("delete", "/players/{id}/", {
    onSuccess,
    onError,
  });

  // The external ids live on their own endpoints but dirty the same player
  // caches, so their invalidation policy belongs here beside the rest.
  const setExternalIdMutation = $api.useMutation(
    "put",
    "/players/{id}/external-ids/{source}/",
    { onSuccess, onError },
  );

  // A merge rewrites the merged player's matches, registrations and ratings,
  // so it dirties every cache that nests a player, not just the player caches.
  const onMergeSuccess = () => {
    onSuccess();
    for (const key of [
      endpointKey("get", "/competitions/{name}/pairing"),
      endpointKey("get", "/competitions/{name}/registrations"),
      endpointKey("get", "/competitions/{name}/player-ratings"),
      endpointKey("post", "/competitions/{name}/ranking"),
    ]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const mergeMutation = $api.useMutation("post", "/players/{id}/merge/", {
    onSuccess: onMergeSuccess,
    onError,
  });

  const deleteExternalIdMutation = $api.useMutation(
    "delete",
    "/players/{id}/external-ids/{source}/",
    { onSuccess, onError },
  );

  return {
    players,
    error,
    isError,
    isPending,
    createMutation,
    editMutation,
    deleteMutation,
    setExternalIdMutation,
    deleteExternalIdMutation,
    mergeMutation,
  };
}
