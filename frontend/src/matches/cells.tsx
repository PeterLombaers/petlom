import { Tooltip } from "@mantine/core";
import { components } from "@client/schema";
import PlayerSelect from "@/players/PlayerSelect";
import { PlayerName } from "@/ui/PlayerName";
import type { EditProps } from "@/table/types";
import ResultToggle from "./ResultToggle";

type PlayerRef = components["schemas"]["PlayerRef"];
type Result = components["schemas"]["Result"];

export const playerSelectCell = {
  renderValue: (props: { value: PlayerRef }) => (
    <Tooltip
      label={props.value.name}
      events={{ hover: true, focus: false, touch: true }}
    >
      <span>
        <PlayerName name={props.value.name} isActive={props.value.is_active} />
      </span>
    </Tooltip>
  ),
  renderEdit: (props: EditProps<PlayerRef>) => (
    <PlayerSelect
      player={props.editValue}
      setPlayer={props.onChange}
      error={!!props.error}
      helperText={props.error}
    />
  ),
};

export const resultToggleCell = {
  renderValue: (props: { value: Result | null | undefined }) =>
    props.value ?? "—",
  renderEdit: (props: EditProps<Result | null | undefined>) => (
    <ResultToggle result={props.editValue ?? null} setResult={props.onChange} />
  ),
};
