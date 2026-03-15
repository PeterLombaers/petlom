import { Autocomplete, TextField } from "@mui/material";
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

  return (
    <Autocomplete
      autoComplete
      loading={isPending}
      disabled={isError}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      options={filterOptions ? filterOptions(dbPlayers || []) : dbPlayers || []}
      value={isError ? { id: 0, name: "Error", is_active: true } : player}
      onChange={(_, newValue) => {
        if (newValue) {
          setPlayer(newValue);
        }
      }}
      getOptionLabel={(player: PlayerMinimal) => {
        return player.name;
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
        />
      )}
      sx={{ minWidth: 200 }}
    />
  );
}
