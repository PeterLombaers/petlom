import { components } from "@client/schema";
import type { EditProps } from "@/table/types";
import ExternalIdInput from "./ExternalIdInput";
import { PlayerRow } from "./usePlayerRows";

type ExternalRatingSource = components["schemas"]["ExternalRatingSource"];

/**
 * A player's identifier at a rating source: text, editable through a search.
 *
 * Domain-specific because the edit control searches the source, and it needs
 * the row for the name to search with.
 */
export const createExternalIdCell = (source: ExternalRatingSource) => ({
  renderValue: (props: { value: string }) => props.value,
  renderEdit: (props: EditProps<string, PlayerRow>) => (
    <ExternalIdInput
      source={source}
      playerName={props.row.name}
      value={props.editValue}
      onChange={props.onChange}
      error={props.error}
    />
  ),
});
