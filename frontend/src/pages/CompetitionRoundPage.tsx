import { useParams } from "react-router-dom";
import { apiClient } from "../utils";
import { components } from "../client/schema";
import NotFoundPage from "./NotFoundPage";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@mui/material";

type CompetitionPublic = components["schemas"]["CompetitionPublic"];
type MatchPublic = components["schemas"]["MatchPublic"];

const getCompetition = async (name: string): Promise<CompetitionPublic> => {
  const { data, error } = await apiClient.GET("/competitions/{name}", {
    params: { path: { name: name } },
  });
  if (error) {
    throw new Error(`Error in fetching competitions: ${error.detail}`);
  }
  return data;
};

const getRoundMatches = async (
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

export default function CompetitionRoundPage() {
  const { name, round } = useParams();
  if (!name || !round) {
    return <NotFoundPage />;
  }
  const round_nr = parseInt(round);
  if (!round_nr) {
    return <NotFoundPage />;
  }

  const {
    data: competition,
    error: errorCompetition,
    isPending: isPendingCompetition,
  } = useQuery({
    queryKey: ["/competitions/", "GET", name],
    queryFn: () => getCompetition(name),
  });
  const {
    data: matches,
    error: errorMatches,
    isPending: isPendingMatches,
  } = useQuery({
    queryKey: ["/competitions/", "GET", name, round_nr],
    queryFn: () => getRoundMatches(name, round_nr),
  });

  if (isPendingCompetition) {
    return <div>Loading...</div>;
  }
  if (errorCompetition || !competition) {
    console.log(errorCompetition);
    return <NotFoundPage />;
  }

  if (isPendingMatches) {
    return <div>Loading</div>;
  }
  if (errorMatches || !matches) {
    console.log(errorMatches);
    return <NotFoundPage />;
  }
  return (
    <>
      <Typography variant="h2" align="center">
        CompetitionDetailPage {competition.name}
      </Typography>
      {matches.map((match) => {
        return (
          <Typography variant="h6" key={match.id}>
            Player {match.player_white_id} - Player {match.player_black_id}:{" "}
            {match.result}
          </Typography>
        );
      })}
    </>
  );
}
