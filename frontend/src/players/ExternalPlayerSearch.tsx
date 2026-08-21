import { Autocomplete, Loader } from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { components } from "@client/schema";
import { useAuth } from "@/auth";
import { useExternalPlayerSearch } from "./useExternalPlayerSearch";

type ExternalPlayerResult = components["schemas"]["ExternalPlayerResult"];
type ExternalRatingSource = components["schemas"]["ExternalRatingSource"];

type ExternalPlayerSearchProps = {
  source: ExternalRatingSource;
  onSelect: (result: ExternalPlayerResult) => void;
  label?: string;
};

/**
 * Search a rating source for a player and hand the chosen result to `onSelect`.
 *
 * The search endpoint is moderator-only, so nothing renders for other users.
 * To fill in a player's identifier instead, use `ExternalIdInput`.
 */
export default function ExternalPlayerSearch({
  source,
  onSelect,
  label,
}: ExternalPlayerSearchProps) {
  const { t } = useTranslation();
  const { isModerator } = useAuth();
  const [value, setValue] = useState("");
  const { byLabel, options, isFetching } = useExternalPlayerSearch(
    source,
    value,
  );
  const sourceName = t(`externalSource.${source}`);

  if (!isModerator) return null;

  const handleSubmit = (optionLabel: string) => {
    const result = byLabel.get(optionLabel);
    if (!result) return;
    setValue(result.name);
    onSelect(result);
  };

  return (
    <Autocomplete
      name="external-search"
      id="external-search"
      label={label ?? t("player.searchSource", { source: sourceName })}
      placeholder={t("player.searchSourcePlaceholder")}
      value={value}
      onChange={setValue}
      onOptionSubmit={handleSubmit}
      data={options}
      // The source already matched the query — and it matches on words, so it
      // finds "Giri, Anish" for "Anish Giri". Mantine's default filter would
      // then drop that hit for not containing the typed string verbatim.
      filter={({ options }) => options}
      rightSection={isFetching ? <Loader size="xs" /> : undefined}
    />
  );
}
