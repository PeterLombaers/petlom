import { MultiSelect } from "@mantine/core";
import { $api } from "@client/api";
import { components } from "@client/schema";

type PlayerMinimal = components["schemas"]["PlayerPublicMinimal"];
type PlayerMultiSelectProps = {
  players: PlayerMinimal[];
  setPlayers: (players: PlayerMinimal[]) => void;
};

export default function PlayerMultiSelect({
  players,
  setPlayers,
}: PlayerMultiSelectProps) {
  const {
    data: dbPlayers,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/players/");

  if (isError) {
    console.log(error.detail);
  }

  const allPlayers = dbPlayers || [];
  const data = allPlayers.map((p) => ({ value: String(p.id), label: p.name }));

  const handleChange = (values: string[]) => {
    const selected = values
      .map((v) => allPlayers.find((p) => String(p.id) === v))
      .filter(Boolean) as PlayerMinimal[];
    setPlayers(selected);
  };

  return (
    <MultiSelect
      label="Players"
      data={data}
      value={isError ? [] : players.map((p) => String(p.id))}
      onChange={handleChange}
      disabled={isError || isPending}
      searchable
      style={{ minWidth: 200 }}
    />
  );
}
