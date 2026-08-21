import { useDebouncedValue } from "@mantine/hooks";
import { $api } from "@client/api";
import { components } from "@client/schema";
import { useAuth } from "@/auth";

type ExternalPlayerResult = components["schemas"]["ExternalPlayerResult"];
type ExternalRatingSource = components["schemas"]["ExternalRatingSource"];

/** The search endpoint rejects anything shorter. */
export const MIN_QUERY_LENGTH = 2;

/** `Magnus Carlsen — NOR GM (2839)`, skipping whatever the result is missing. */
export function formatResult(result: ExternalPlayerResult) {
  const details = [result.country, result.title].filter(Boolean).join(" ");
  const rating = result.rating === null ? "" : ` (${result.rating})`;
  return details
    ? `${result.name} — ${details}${rating}`
    : `${result.name}${rating}`;
}

/**
 * Search a rating source, debounced, for the components that offer its hits.
 *
 * Both callers render a Mantine `Autocomplete`, which identifies an option by
 * its displayed string, so the hits come back keyed by their label. The search
 * endpoint is moderator-only, so nothing is requested for other users.
 *
 * @param source - The rating source to search.
 * @param query - What to search for. Queries shorter than `MIN_QUERY_LENGTH`
 *   are not sent; each keystroke is debounced by 300ms.
 * @param labelResult - How an option is labelled. Defaults to `formatResult`.
 */
export function useExternalPlayerSearch(
  source: ExternalRatingSource,
  query: string,
  labelResult: (result: ExternalPlayerResult) => string = formatResult,
) {
  const { isModerator } = useAuth();
  const [debouncedQuery] = useDebouncedValue(query, 300);

  const { data: results, isFetching } = $api.useQuery(
    "get",
    "/external/{source}/search/",
    { params: { path: { source }, query: { query: debouncedQuery } } },
    { enabled: isModerator && debouncedQuery.length >= MIN_QUERY_LENGTH },
  );

  const byLabel = new Map<string, ExternalPlayerResult>();
  for (const result of results ?? []) {
    const label = labelResult(result);
    if (!byLabel.has(label)) byLabel.set(label, result);
  }

  return { byLabel, options: [...byLabel.keys()], isFetching };
}
