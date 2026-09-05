import { NumberInput } from "@mantine/core";
import { components } from "@client/schema";
import type { EditProps } from "@/table/types";
import { PlayerName } from "@/ui/PlayerName";
import { RatingValue } from "@/ui/RatingValue";

type PlayerRef = components["schemas"]["PlayerRef"];

export const playerCell = {
  renderValue: (props: { value: PlayerRef }) => (
    <PlayerName name={props.value.name} isActive={props.value.is_active} />
  ),
};

export const readOnlyRatingCell = {
  renderValue: (props: { value: number | null }) => (
    <RatingValue value={props.value} />
  ),
};

export const createEditableRatingCell = (label: string) => ({
  renderValue: (props: { value: number | null }) => (
    <RatingValue value={props.value} />
  ),
  renderEdit: (props: EditProps<number | null>) => (
    <NumberInput
      name="initial-rating"
      aria-label={label}
      value={props.editValue ?? ""}
      error={props.error || undefined}
      min={0}
      onChange={(val) => props.onChange(val === "" ? null : Number(val))}
    />
  ),
});
