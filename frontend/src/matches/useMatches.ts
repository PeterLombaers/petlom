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
  } = $api.useQuery("get", "/competitions/{name}/pairing", {
    params: { path: { name: competitionName }, query: { round_nr: round } },
  });

  const queryClient = useQueryClient();
  const onSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: ["get", "/competitions/{name}/pairing"],
    });
    queryClient.invalidateQueries({
      queryKey: ["get", "/competitions/"],
    });
    queryClient.invalidateQueries({
      queryKey: ["get", "/competitions/{name}/ranking"],
    });
  };
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
    rows: matches,
    error,
    isError,
    isPending,
    createMutation,
    editMutation,
    deleteMutation,
  };
}
