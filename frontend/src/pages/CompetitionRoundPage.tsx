import { useParams } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@mui/material";
import { getCompetition, getRoundMatches } from "../client/api";

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
