import { AnyMutation, TableQueryResult } from "@/table/types";
import { EXTERNAL_SOURCES, getExternalId, getRating } from "./external";
import { usePlayers } from "./usePlayers";

/**
 * One player as the list table shows them: flat, because `Column<T>.field` must
 * be a key of the row type and the external data lives two levels down in
 * `PlayerPublic.external_ids`.
 *
 * A field per source rather than a map, for the same reason. Adding a source
 * means adding its two fields here.
 */
export type PlayerRow = {
  id: number;
  name: string;
  /** The player's id at the source, or `""` when they have none. */
  fide_id: string;
  fide_rating: number | null;
  knsb_id: string;
  knsb_rating: number | null;
};

/** The variables `EditableTable` sends for a row or column edit. */
type EditVariables = {
  body: { name: string; fide_id: string; knsb_id: string };
  params: { path: { id: number } };
};

/**
 * The player list table's rows and mutations.
 *
 * A view-model hook because the table needs a shape the API does not return:
 * flat rows, and a single edit mutation even though the editable columns hit
 * different endpoints — the name is a `PATCH /players/{id}/`, an external id a
 * `PUT`/`DELETE` on that source's external id. The endpoints themselves stay in
 * `usePlayers`; this only composes them.
 */
export function usePlayerRows() {
  const {
    players,
    error,
    isError,
    isPending,
    createMutation,
    editMutation,
    deleteMutation,
    setExternalIdMutation,
    deleteExternalIdMutation,
  } = usePlayers();

  const rows = players?.map((player) => ({
    id: player.id,
    name: player.name,
    fide_id: getExternalId(player, "fide") ?? "",
    fide_rating: getRating(player, "fide")?.rating ?? null,
    knsb_id: getExternalId(player, "knsb") ?? "",
    knsb_rating: getRating(player, "knsb")?.rating ?? null,
  }));

  // Diffed against the row as last fetched, so an edit that only touched the
  // name does not also rewrite an external id (and vice versa).
  const applyEdit = async ({ body, params }: EditVariables) => {
    const id = params.path.id;
    const previous = rows?.find((row) => row.id === id);

    if (previous?.name !== body.name) {
      await editMutation.mutateAsync({
        body: { name: body.name },
        params: { path: { id } },
      });
    }
    for (const source of EXTERNAL_SOURCES) {
      const externalId = body[`${source}_id`].trim();
      if (previous?.[`${source}_id`] === externalId) continue;
      const path = { id, source };
      if (externalId) {
        await setExternalIdMutation.mutateAsync({
          body: { external_id: externalId },
          params: { path },
        });
      } else {
        await deleteExternalIdMutation.mutateAsync({ params: { path } });
      }
    }
  };

  // Both entry points are needed: `EditableRow` saves with `mutate` and an
  // `onSuccess` callback, `useTableEditState` saves a column with `mutateAsync`
  // and reports the rejections per row. Nothing in the table reads the rest of
  // `UseMutationResult`, so this composite only implements the three members.
  const compositeEditMutation = {
    isPending:
      editMutation.isPending ||
      setExternalIdMutation.isPending ||
      deleteExternalIdMutation.isPending,
    mutateAsync: applyEdit,
    mutate: (
      variables: EditVariables,
      options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
    ) => {
      applyEdit(variables).then(
        () => options?.onSuccess?.(),
        (error) => options?.onError?.(error),
      );
    },
  } as unknown as AnyMutation;

  return {
    rows,
    error,
    isError,
    isPending,
    createMutation,
    editMutation: compositeEditMutation,
    deleteMutation,
  } satisfies TableQueryResult<PlayerRow>;
}
