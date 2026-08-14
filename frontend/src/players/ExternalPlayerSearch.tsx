import { Autocomplete, Loader } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { $api } from "@client/api";
import { components } from "@client/schema";
import { useAuth } from "@/auth";

type ExternalPlayerResult = components["schemas"]["ExternalPlayerResult"];
type ExternalRatingSource = components["schemas"]["ExternalRatingSource"];

/** The search endpoint rejects anything shorter. */
const MIN_QUERY_LENGTH = 2;

/** `Magnus Carlsen — NOR GM (2839)`, skipping whatever the result is missing. */
function formatResult(result: ExternalPlayerResult) {
  const details = [result.country, result.title].filter(Boolean).join(" ");
  const rating = result.rating === null ? "" : ` (${result.rating})`;
  return details
    ? `${result.name} — ${details}${rating}`
    : `${result.name}${rating}`;
}

type ExternalPlayerSearchProps = {
  source: ExternalRatingSource;
  onSelect: (result: ExternalPlayerResult) => void;
  label?: string;
};

/**
 * Search a rating source for a player and hand the chosen result to `onSelect`.
 *
 * The search endpoint is moderator-only, so nothing renders for other users.
 */
export default function ExternalPlayerSearch({
  source,
  onSelect,
  label,
}: ExternalPlayerSearchProps) {
  const { t } = useTranslation();
  const { isModerator } = useAuth();
  const [value, setValue] = useState("");
  const [debouncedValue] = useDebouncedValue(value, 300);
  const sourceName = t(`externalSource.${source}`);

  const { data: results, isFetching } = $api.useQuery(
    "get",
    "/external/{source}/search/",
    {
      params: {
        path: { source },
        query: { query: debouncedValue },
      },
    },
    { enabled: isModerator && debouncedValue.length >= MIN_QUERY_LENGTH },
  );

  if (!isModerator) return null;

  // Autocomplete identifies an option by its displayed string, so map back from it.
  const byLabel = new Map<string, ExternalPlayerResult>();
  for (const result of results ?? []) {
    const optionLabel = formatResult(result);
    if (!byLabel.has(optionLabel)) byLabel.set(optionLabel, result);
  }

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
      data={[...byLabel.keys()]}
      rightSection={isFetching ? <Loader size="xs" /> : undefined}
    />
  );
}
