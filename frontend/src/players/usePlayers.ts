import { $api, endpointKey } from "@/client/api";
import { useQueryClient } from "@tanstack/react-query";

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
  // Failures are reported by the global handler in `App.tsx`. The two mutations
  // marked `silent` are the exception: their callers render the error where the
  // user is looking — field errors in the create dialog, a per-row error in a
  // column edit — and a toast on top of that would only repeat it.
  const createMutation = $api.useMutation("post", "/players/", {
    onSuccess,
    meta: { silent: true },
  });

  const editMutation = $api.useMutation("patch", "/players/{id}/", {
    onSuccess,
    meta: { silent: true },
  });

  const deleteMutation = $api.useMutation("delete", "/players/{id}/", {
    onSuccess,
  });

  // The external ids live on their own endpoints but dirty the same player
  // caches, so their invalidation policy belongs here beside the rest.
  const setExternalIdMutation = $api.useMutation(
    "put",
    "/players/{id}/external-ids/{source}/",
    { onSuccess },
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

  // `silent` for the same reason as the others: `MergePlayerModal` keeps the
  // failure on screen next to the two players it was about.
  const mergeMutation = $api.useMutation("post", "/players/{id}/merge/", {
    onSuccess: onMergeSuccess,
    meta: {
      silent: true,
      successMessage: "notifications.playersMerged",
    },
  });

  const deleteExternalIdMutation = $api.useMutation(
    "delete",
    "/players/{id}/external-ids/{source}/",
    { onSuccess },
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
