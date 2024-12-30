import { useParams } from "react-router-dom";

export default function CompetitionRoundPage() {
  const { name, round } = useParams();
  return (
    <div>
      CompetitionRoundPage {name} {round}
    </div>
  );
}
