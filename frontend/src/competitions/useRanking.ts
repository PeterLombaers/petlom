import { $api } from "@/client/api";

export function useRanking(competitionName: string, roundNr?: number) {
  return $api.useQuery("get", "/competitions/{name}/ranking", {
    params: {
      path: { name: competitionName },
      query: { round_nr: roundNr },
    },
  });
}
