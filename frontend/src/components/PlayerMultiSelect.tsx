import { Autocomplete, TextField } from "@mui/material";
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

  return (
    <Autocomplete
      autoComplete
      multiple
      loading={isPending}
      disabled={isError}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      options={dbPlayers || []}
      value={isError ? [{ id: 0, name: "Error", is_active: true }] : players}
      onChange={(_, newValue) => {
        setPlayers(newValue);
      }}
      getOptionLabel={(player: PlayerMinimal) => {
        return player.name;
      }}
      renderInput={(params) => <TextField {...params} label="Player" />}
      sx={{ minWidth: 200 }}
    />
  );
}
