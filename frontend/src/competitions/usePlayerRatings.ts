import { $api, endpointKey } from "@/client/api";
import { components } from "@/client/schema";
import { AnyMutation, TableQueryResult } from "@/table/types";
import { useQueryClient } from "@tanstack/react-query";

type CompetitionRatingPublic = components["schemas"]["CompetitionRatingPublic"];

/**
 * The rating for all players that have participated in a competition.
 */
export function usePlayerRatings(competitionName: string) {
  const {
    data: ratings,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/competitions/{name}/player-ratings", {
    params: { path: { name: competitionName } },
  });

  const queryClient = useQueryClient();
  // An initial rating is an input to every rating derived in this competition,
  // so it dirties the ranking and the registration list (which show derived
  // ratings) as well as this roster and the player pages.
  const patchMutation = $api.useMutation(
    "patch",
    "/competitions/{name}/player-ratings/{player_id}",
    {
      meta: { silent: true },
      onSuccess: () => {
        for (const path of [
          "/competitions/{name}/player-ratings",
          "/competitions/{name}/ranking",
          "/competitions/{name}/registrations",
          "/players/{id}/",
        ] as const) {
          queryClient.invalidateQueries({ queryKey: endpointKey("get", path) });
        }
      },
    },
  );

  // The table engine fills in only the row's id field as a path parameter, so
  // the competition name is added here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withCompetitionName = (variables: any) => ({
    ...variables,
    params: {
      ...variables?.params,
      path: { ...variables?.params?.path, name: competitionName },
    },
  });
  const editMutation = {
    ...patchMutation,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutate: (variables: any, options?: any) =>
      patchMutation.mutate(withCompetitionName(variables), options),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutateAsync: (variables: any, options?: any) =>
      patchMutation.mutateAsync(withCompetitionName(variables), options),
  } as AnyMutation;

  return {
    rows: ratings,
    error,
    isError,
    isPending,
    editMutation,
  } satisfies TableQueryResult<CompetitionRatingPublic>;
}
