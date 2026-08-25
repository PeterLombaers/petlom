import { $api, endpointKey, formatHTTPValidationError } from "@/client/api";
import { components } from "@/client/schema";
import { TableQueryResult } from "@/table/types";
import { useQueryClient } from "@tanstack/react-query";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];
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
    onError: (error: HTTPValidationError) => {
      console.error(formatHTTPValidationError(error));
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
  const onError = (error: HTTPValidationError) => {
    const errorMessage = formatHTTPValidationError(error);
    console.error(errorMessage);
  };

  const createMutation = $api.useMutation("post", "/competitions/", {
    onSuccess,
    onError,
  });

  const editMutation = $api.useMutation("patch", "/competitions/{name}", {
    onSuccess,
    onError,
  });

  const deleteMutation = $api.useMutation("delete", "/competitions/{name}", {
    onSuccess,
    onError,
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
