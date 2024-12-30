import createFetchClient from "openapi-fetch";
import type { paths, components } from "./schema.js";

export const apiClient = createFetchClient<paths>({
  baseUrl: "http://localhost:8000/",
});

type CompetitionPublic = components["schemas"]["CompetitionPublic"];
type MatchPublic = components["schemas"]["MatchPublic"];

export const getCompetitionList = async (): Promise<CompetitionPublic[]> => {
  const { data, error } = await apiClient.GET("/competitions/");
  if (error) {
    throw new Error(`Error in fetching competitions: ${error.detail}`);
  }
  return data;
};

export const getCompetition = async (
  name: string
): Promise<CompetitionPublic> => {
  const { data, error } = await apiClient.GET("/competitions/{name}", {
    params: { path: { name: name } },
  });
  if (error) {
    throw new Error(`Error in fetching competitions: ${error.detail}`);
  }
  return data;
};

export const getRoundMatches = async (
  name: string,
  round_nr: number
): Promise<MatchPublic[]> => {
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
