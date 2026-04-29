import { Select } from "@mantine/core";
import { $api } from "@client/api";
import { components } from "@client/schema";

type PlayerMinimal = components["schemas"]["PlayerPublicMinimal"];
type PlayerSelectProps = {
  player: PlayerMinimal;
  setPlayer: (player: PlayerMinimal) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  filterOptions?: (options: PlayerMinimal[]) => PlayerMinimal[];
};

export default function PlayerSelect({
  player,
  setPlayer,
  label = "Player",
  error = false,
  helperText = "",
  filterOptions,
}: PlayerSelectProps) {
  const {
    data: dbPlayers,
    error: mutateError,
    isPending,
    isError,
  } = $api.useQuery("get", "/players/");

  if (isError) {
    console.log(mutateError.detail);
  }

  const allPlayers = dbPlayers || [];
  const filteredPlayers = filterOptions
    ? filterOptions(allPlayers)
    : allPlayers;
  const data = filteredPlayers.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  const handleChange = (value: string | null) => {
    if (!value) return;
    const found = allPlayers.find((p) => String(p.id) === value);
    if (found) setPlayer(found);
  };

  return (
    <Select
      label={label}
      data={data}
      value={isError ? null : String(player.id)}
      onChange={handleChange}
      disabled={isError || isPending}
      error={error ? helperText || true : undefined}
      searchable
      style={{ minWidth: 200 }}
    />
  );
}
