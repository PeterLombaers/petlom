import { $api, endpointKey } from "@/client/api";
import { useQueryClient } from "@tanstack/react-query";

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
      queryKey: endpointKey("get", "/competitions/{name}/registrations"),
    });
  };
  const updateMutation = $api.useMutation(
    "patch",
    "/competitions/{name}/registrations",
    { onSuccess },
  );

  const deleteMutation = $api.useMutation(
    "delete",
    "/competitions/{name}/registrations",
    { onSuccess },
  );

  const createPairingMutation = $api.useMutation(
    "post",
    "/competitions/{name}/pairing",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: endpointKey("get", "/competitions/{name}/pairing"),
        });
        queryClient.invalidateQueries({
          queryKey: endpointKey("get", "/competitions/{name}"),
        });
        queryClient.invalidateQueries({
          queryKey: endpointKey("get", "/competitions/"),
        });
        queryClient.invalidateQueries({
          queryKey: endpointKey("get", "/competitions/{name}/registrations"),
        });
      },
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
