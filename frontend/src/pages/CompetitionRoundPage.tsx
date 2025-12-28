import { useParams } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";
import { MatchList } from "../matches/MatchList";

export default function CompetitionRoundPage() {
  const { name, round } = useParams();
  if (!name || !round) {
    return <NotFoundPage />;
  }
  const round_nr = parseInt(round);
  if (!round_nr) {
    return <NotFoundPage />;
  }

  return MatchList({ competition_name: name, round: round_nr });
}
