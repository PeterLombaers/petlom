import { $api, endpointKey } from "@/client/api";
import { components } from "@/client/schema";
import { TableQueryResult } from "@/table/types";
import { useQueryClient } from "@tanstack/react-query";

type CompetitionPublic = components["schemas"]["CompetitionPublic"];

export function useCompetition(name: string) {
  const { data, error, isPending, isError } = $api.useQuery(
    "get",
    "/competitions/{name}",
    { params: { path: { name } } },
  );

  const queryClient = useQueryClient();
  // Finishing changes the competition itself and its row in the list, so it
  // dirties the same two caches an edit does.
  const finishMutation = $api.useMutation("patch", "/competitions/{name}", {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: endpointKey("get", "/competitions/{name}"),
      });
      queryClient.invalidateQueries({
        queryKey: endpointKey("get", "/competitions/"),
      });
    },
  });

  return { data, error, isPending, isError, finishMutation };
}

export function useCompetitions() {
  const {
    data: competitions,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/competitions/");

  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({
      queryKey: endpointKey("get", "/competitions/"),
    });
  // See `usePlayers` for why create and edit are `silent` and delete is not.
  const createMutation = $api.useMutation("post", "/competitions/", {
    onSuccess,
    meta: { silent: true },
  });

  const editMutation = $api.useMutation("patch", "/competitions/{name}", {
    onSuccess,
    meta: { silent: true },
  });

  const deleteMutation = $api.useMutation("delete", "/competitions/{name}", {
    onSuccess,
  });

  return {
    rows: competitions,
    error,
    isError,
    isPending,
    createMutation,
    editMutation,
    deleteMutation,
  } satisfies TableQueryResult<CompetitionPublic>;
}
