import { $api, formatHTTPValidationError } from "@/client/api";
import { components } from "@/client/schema";
import { useQueryClient } from "@tanstack/react-query";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];

export function useRegistrations(competitionName: string, roundNr: number) {
  const {
    data: registrations,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/competitions/{name}/registrations", {
    params: { path: { name: competitionName }, query: { round_nr: roundNr } },
  });

  const queryClient = useQueryClient();
  const onSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: ["get", "/competitions/{name}/registrations"],
    });
  };
  const onError = (error: HTTPValidationError) => {
    const errorMessage = formatHTTPValidationError(error);
    console.error(errorMessage);
  };

  const updateMutation = $api.useMutation(
    "patch",
    "/competitions/{name}/registrations",
    { onSuccess, onError },
  );

  const deleteMutation = $api.useMutation(
    "delete",
    "/competitions/{name}/registrations",
    { onSuccess, onError },
  );

  const createPairingMutation = $api.useMutation(
    "post",
    "/competitions/{name}/pairing",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["get", "/competitions/{name}/pairing"],
        });
        queryClient.invalidateQueries({
          queryKey: ["get", "/competitions/{name}"],
        });
        queryClient.invalidateQueries({
          queryKey: ["get", "/competitions/"],
        });
        queryClient.invalidateQueries({
          queryKey: ["get", "/competitions/{name}/registrations"],
        });
      },
      onError,
    },
  );

  return {
    registrations,
    error,
    isError,
    isPending,
    updateMutation,
    deleteMutation,
    createPairingMutation,
  };
}
