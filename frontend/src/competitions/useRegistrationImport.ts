import { $api } from "@/client/api";

/**
 * What signing up on the club website would add to a round.
 *
 * Its own hook rather than part of `useRegistrations`: it is read-only and
 * changes nothing, so it carries none of that hook's invalidation policy. It is
 * also the one query in the app that must never be served from cache -- people
 * keep signing up while the round is being put together, and the point of
 * opening the overview is to see the list as it is right now.
 */
export function useRegistrationImport(
  competitionName: string,
  roundNr: number,
) {
  return $api.useQuery(
    "get",
    "/competitions/{name}/registrations/import-preview",
    {
      params: {
        path: { name: competitionName },
        query: { round_nr: roundNr },
      },
    },
    { gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: false },
  );
}
