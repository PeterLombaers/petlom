import createFetchClient from "openapi-fetch";
import type { paths, components } from "./schema.js";

export const apiClient = createFetchClient<paths>({
  baseUrl: "http://localhost:8000/",
});

type CompetitionPublic = components["schemas"]["CompetitionPublic"];
type CompetitionPublicWithNRounds =
  components["schemas"]["CompetitionPublicWithNRounds"];
type CompetitionRound = components["schemas"]["CompetitionRound"];
type PlayerPublic = components["schemas"]["PlayerPublic"];

export const getCompetitionList = async (): Promise<CompetitionPublic[]> => {
  const { data, error } = await apiClient.GET("/competitions/");
  if (error) {
    throw new Error(`Error in fetching competitions: ${error.detail}`);
  }
  return data;
};

export const getCompetition = async (
  name: string
): Promise<CompetitionPublicWithNRounds> => {
  const { data, error } = await apiClient.GET("/competitions/{name}", {
    params: { path: { name: name } },
  });
  if (error) {
    throw new Error(`Error in fetching competitions: ${error.detail}`);
  }
  return data;
};

export const getCompetitionRound = async (
  name: string,
  round_nr: number
): Promise<CompetitionRound> => {
  const { data, error } = await apiClient.GET(
    "/competitions/{name}/round/{round_nr}",
    {
      params: { path: { name: name, round_nr: round_nr } },
    }
  );
  if (error) {
    throw new Error(`Error in fetching competitions: ${error.detail}`);
  }
  return data;
};

export const getPlayerList = async (
  is_active: boolean | null
): Promise<PlayerPublic[]> => {
  const params = is_active !== null ? { query: { is_active: true } } : {};
  const { data, error } = await apiClient.GET("/players/", {
    params: params,
  });
  if (error) {
    throw new Error(`Error in fetching players: ${error.detail}`);
  }
  return data;
};
