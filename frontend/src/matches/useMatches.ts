import { $api, formatHTTPValidationError } from "@/client/api";
import { components } from "@/client/schema";
import { useQueryClient } from "@tanstack/react-query";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];

export function useMatches(competitionName: string, round: number) {
  const {
    data: matches,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/competitions/{name}/round/{round_nr}", {
    params: { path: { name: competitionName, round_nr: round } },
  });

  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({
      queryKey: ["get", "/competitions/{name}/round/{round_nr}"],
    });
  const onError = (error: HTTPValidationError) => {
    const errorMessage = formatHTTPValidationError(error);
    console.error(errorMessage);
  };

  const createMutation = $api.useMutation("post", "/matches/", {
    onSuccess,
    onError,
  });

  const editMutation = $api.useMutation("patch", "/matches/{id}", {
    onSuccess,
    onError,
  });

  const deleteMutation = $api.useMutation("delete", "/matches/{id}", {
    onSuccess,
    onError,
  });

  return {
    matches,
    error,
    isError,
    isPending,
    createMutation,
    editMutation,
    deleteMutation,
  };
}
