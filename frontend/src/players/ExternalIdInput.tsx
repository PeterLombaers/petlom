import {
  Autocomplete,
  Loader,
  RenderAutocompleteOption,
  Text,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { components } from "@client/schema";
import {
  formatResult,
  MIN_QUERY_LENGTH,
  useExternalPlayerSearch,
} from "./useExternalPlayerSearch";

type ExternalPlayerResult = components["schemas"]["ExternalPlayerResult"];
type ExternalRatingSource = components["schemas"]["ExternalRatingSource"];

/**
 * The identifier labels the option, because `Autocomplete` puts the label of
 * the chosen option in the field and the identifier is what the field holds.
 * Who that identifier belongs to is drawn by `renderOption` instead, which
 * only reaches the dropdown.
 */
const labelId = (result: ExternalPlayerResult) => result.external_id;

type ExternalIdInputProps = {
  source: ExternalRatingSource;
  /** The Petlom player this identifier is for; the default search query. */
  playerName: string;
  value: string;
  onChange: (externalId: string) => void;
  error?: string;
  /** A visible label. Omit it in a table cell, where the header names the field. */
  label?: string;
};

/**
 * The identifier of a player at a rating source, typed or picked from a search.
 *
 * An empty field searches for the player's name, so opening it already offers
 * the candidates for that player; typing searches for what was typed, which
 * for an identifier is the source's exact match — pasting one shows whose it
 * is. Either way the field's value stays the identifier, and typing one by
 * hand keeps working for a player the source cannot be searched for.
 */
export default function ExternalIdInput({
  source,
  playerName,
  value,
  onChange,
  error,
  label,
}: ExternalIdInputProps) {
  const { t } = useTranslation();
  const sourceName = t(`externalSource.${source}`);
  const query = value.trim().length >= MIN_QUERY_LENGTH ? value : playerName;
  const {
    byLabel: byId,
    options,
    isFetching,
  } = useExternalPlayerSearch(source, query, labelId);

  // The identifier in the field is searched for as well, so whoever it belongs
  // to is among the results — for a chosen one as much as a hand-typed one.
  const chosen = byId.get(value);

  const renderOption: RenderAutocompleteOption = ({ option }) => {
    const result = byId.get(option.value);
    // Cannot happen: the options are the keys of that map.
    if (!result) return option.value;
    return (
      <div>
        <Text size="sm">{formatResult(result)}</Text>
        <Text size="xs" c="dimmed">
          {result.external_id}
        </Text>
      </div>
    );
  };

  return (
    <Autocomplete
      name={`player-${source}-id`}
      label={label}
      // Only where no visible label names the field, as in a table cell.
      aria-label={
        label
          ? undefined
          : t("player.searchIdFor", { source: sourceName, name: playerName })
      }
      placeholder={t("player.sourceId", { source: sourceName })}
      // Naming whoever the identifier belongs to, so a bare number can be
      // checked against the player it is meant for.
      description={chosen ? formatResult(chosen) : undefined}
      value={value}
      onChange={onChange}
      data={options}
      renderOption={renderOption}
      error={error || undefined}
      // The source already matched the query — and it matches on words, so it
      // finds "Carlsen, Magnus" for "Magnus Carlsen". Mantine's default filter
      // would then drop that hit for not containing the typed string verbatim.
      filter={({ options }) => options}
      rightSection={isFetching ? <Loader size="xs" /> : undefined}
    />
  );
}
