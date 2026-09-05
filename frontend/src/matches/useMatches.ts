import { $api, endpointKey } from "@/client/api";
import { components } from "@/client/schema";
import { TableQueryResult } from "@/table/types";
import { useQueryClient } from "@tanstack/react-query";

type MatchPublic = components["schemas"]["MatchPublic"];

export function useMatches(competitionName: string, round: number) {
  const {
    data: matches,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/competitions/{name}/pairing", {
    params: { path: { name: competitionName }, query: { round_nr: round } },
  });

  const queryClient = useQueryClient();
  const onSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: endpointKey("get", "/competitions/{name}/pairing"),
    });
    queryClient.invalidateQueries({
      queryKey: endpointKey("get", "/competitions/"),
    });
    queryClient.invalidateQueries({
      queryKey: endpointKey("get", "/competitions/{name}/ranking"),
    });
  };
  // See `usePlayers` for why create and edit are `silent` and delete is not.
  const createMutation = $api.useMutation("post", "/matches/", {
    onSuccess,
    meta: { silent: true },
  });

  const editMutation = $api.useMutation("patch", "/matches/{id}", {
    onSuccess,
    meta: { silent: true },
  });

  const deleteMutation = $api.useMutation("delete", "/matches/{id}", {
    onSuccess,
  });

  return {
    rows: matches,
    error,
    isError,
    isPending,
    createMutation,
    editMutation,
    deleteMutation,
  } satisfies TableQueryResult<MatchPublic>;
}
