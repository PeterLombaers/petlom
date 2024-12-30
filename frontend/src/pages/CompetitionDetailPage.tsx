import { useParams } from "react-router-dom";

export default function CompetitionDetailPage() {
  const { name } = useParams();
  return <div>CompetitionDetailPage {name}</div>;
}
