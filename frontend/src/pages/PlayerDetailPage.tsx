import { useParams } from "react-router-dom";

export default function PlayerDetailPage() {
  const { playerId } = useParams();
  return <div>PlayerDetailPage {playerId}</div>;
}
