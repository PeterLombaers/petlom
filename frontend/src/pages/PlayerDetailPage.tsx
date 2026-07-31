import { useParams } from "react-router-dom";
import PlayerDetail from "@/players/PlayerDetail";
import NotFoundPage from "./NotFoundPage";

export default function PlayerDetailPage() {
  const { playerId } = useParams();
  const id = Number(playerId);
  if (!Number.isInteger(id) || id < 1) return <NotFoundPage />;

  return <PlayerDetail playerId={id} />;
}
