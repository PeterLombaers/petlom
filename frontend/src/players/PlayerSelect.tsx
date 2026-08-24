import { Select } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { $api } from "@client/api";
import { components } from "@client/schema";

type PlayerRef = components["schemas"]["PlayerRef"];
type PlayerSelectProps = {
  player: PlayerRef;
  setPlayer: (player: PlayerRef) => void;
  error?: boolean;
  helperText?: string;
  filterOptions?: (options: PlayerRef[]) => PlayerRef[];
  label?: string;
  placeholder?: string;
};

export default function PlayerSelect({
  player,
  setPlayer,
  error = false,
  helperText = "",
  filterOptions,
  label,
  placeholder,
}: PlayerSelectProps) {
  const { t } = useTranslation();
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
  // The endpoint only lists active players, so a soft-deleted player already
  // set on the row would otherwise drop out of the options and show as blank.
  const options =
    player.id !== 0 && !filteredPlayers.some((p) => p.id === player.id)
      ? [player, ...filteredPlayers]
      : filteredPlayers;
  // Mantine option labels are plain strings, so a deleted player is marked
  // with a suffix here rather than with the PlayerName badge.
  const data = options.map((p) => ({
    value: String(p.id),
    label: p.is_active ? p.name : t("player.deletedSuffix", { name: p.name }),
  }));

  const handleChange = (value: string | null) => {
    if (!value) return;
    const found = options.find((p) => String(p.id) === value);
    if (found) setPlayer(found);
  };

  return (
    <Select
      data={data}
      value={isError ? null : String(player.id)}
      onChange={handleChange}
      disabled={isError || isPending}
      error={error ? helperText || true : undefined}
      searchable
      comboboxProps={{ width: "max-content" }}
      label={label}
      placeholder={placeholder}
    />
  );
}
