import { PlayerList } from "../players/PlayerList";
import CreatePlayerButton from "../players/CreatePlayerButton";

export default function PlayerListPage() {
  return (
    <>
      <CreatePlayerButton />
      <PlayerList />
    </>
  );
}
