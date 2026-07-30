import { Tooltip } from "@mantine/core";
import { components } from "@client/schema";
import PlayerSelect from "@/players/PlayerSelect";
import ResultToggle from "./ResultToggle";

type PlayerPublicMinimal = components["schemas"]["PlayerPublicMinimal"];
type Result = components["schemas"]["Result"];

export const createPlayerSelectCell = () => ({
  renderValue: (props: { value: PlayerPublicMinimal }) => (
    <Tooltip
      label={props.value.name}
      events={{ hover: true, focus: false, touch: true }}
    >
      <span>{props.value.name}</span>
    </Tooltip>
  ),
  renderEdit: (props: {
    editValue: PlayerPublicMinimal;
    error: string;
    onChange: (newValue: PlayerPublicMinimal) => void;
  }) => (
    <PlayerSelect
      player={props.editValue}
      setPlayer={props.onChange}
      error={!!props.error}
      helperText={props.error}
    />
  ),
});

export const createResultToggleCell = () => ({
  renderValue: (props: { value: Result | null | undefined }) =>
    props.value ?? "—",
  renderEdit: (props: {
    editValue: Result | null | undefined;
    error: string;
    onChange: (newValue: Result | null) => void;
  }) => (
    <ResultToggle result={props.editValue ?? null} setResult={props.onChange} />
  ),
});
