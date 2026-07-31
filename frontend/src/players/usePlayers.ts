import { $api, endpointKey, formatHTTPValidationError } from "@/client/api";
import { components } from "@/client/schema";
import { TableQueryResult } from "@/table/types";
import { useQueryClient } from "@tanstack/react-query";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];
type PlayerPublic = components["schemas"]["PlayerPublic"];

export function usePlayers() {
  const {
    data: players,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/players/");

  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: endpointKey("get", "/players/") });
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

  return {
    rows: players,
    error,
    isError,
    isPending,
    createMutation,
    editMutation,
    deleteMutation,
  } satisfies TableQueryResult<PlayerPublic>;
}
