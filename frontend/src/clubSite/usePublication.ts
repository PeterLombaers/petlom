import { $api, endpointKey } from "@/client/api";
import { useQueryClient } from "@tanstack/react-query";

/**
 * A round's post on the club website, and publishing the round to it.
 *
 * Publishing is moderator-only, so the query is only made for a moderator:
 * anyone else would get a 401, and a 401 logs the user out.
 */
export function usePublication(
  competitionName: string,
  roundNr: number,
  { enabled }: { enabled: boolean },
) {
  const params = {
    path: { name: competitionName },
    query: { round_nr: roundNr },
  };
  const publication = $api.useQuery(
    "get",
    "/competitions/{name}/publication",
    { params },
    { enabled },
  );

  const queryClient = useQueryClient();
  const publishMutation = $api.useMutation(
    "post",
    "/competitions/{name}/publication",
    {
      meta: { successMessage: "notifications.roundPublished" },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: endpointKey("get", "/competitions/{name}/publication"),
        });
      },
    },
  );
  const publish = (options?: { onSuccess?: () => void }) =>
    publishMutation.mutate({ params }, options);

  return { publication, publishMutation, publish };
}

/**
 * The club website's post categories, for choosing a competition's.
 *
 * The list changes about once a season, so it is fetched once per session. A
 * failure (publishing not configured, the site down) leaves the data empty and
 * the picker without options rather than breaking the page.
 */
export function useClubSiteCategories({ enabled }: { enabled: boolean }) {
  return $api.useQuery(
    "get",
    "/club-site/categories",
    {},
    { enabled, staleTime: Infinity, retry: false },
  );
}
