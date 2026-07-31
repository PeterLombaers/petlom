import { Button, Group, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";
import EditableTable from "@/table/EditableTable";
import {
  createNonEmptyStringValidator,
  createTextCell,
  readOnlyNumberCell,
  readOnlyOptionalNumberCell,
} from "@/table/cells";
import { fideProfileUrl } from "./external";
import { usePlayerCreateConfig } from "./playerCreateConfig";
import { useImportExternalRatings } from "./useImportExternalRatings";
import { PlayerRow, usePlayerRows } from "./usePlayerRows";

const sanitizeData = (row: PlayerRow) => ({
  ...row,
  name: row.name.trim(),
  fide_id: row.fide_id.trim(),
});
const getRequestBody = (row: PlayerRow) => ({
  name: row.name,
  fide_id: row.fide_id,
});

export default function PlayerTable() {
  const { t } = useTranslation();
  const { isModerator } = useAuth();
  const queryResult = usePlayerRows();
  const createConfig = usePlayerCreateConfig();
  const importMutation = useImportExternalRatings();

  const validatePlayerName = createNonEmptyStringValidator(
    "name",
    t("common.valueRequired"),
  );

  const validateData = (row: PlayerRow) => {
    const errors: Record<string, string> = {};
    validatePlayerName(row.name, errors);
    return errors;
  };

  return (
    <Stack>
      {isModerator && (
        <Group justify="flex-end">
          <Button
            loading={importMutation.isPending}
            onClick={() =>
              importMutation.mutate({
                params: { path: { source: "fide" } },
                body: { update_existing: false },
              })
            }
          >
            {t("player.importFideRatings")}
          </Button>
        </Group>
      )}
      <EditableTable<PlayerRow>
        queryResult={queryResult}
        entityType="player"
        columns={[
          {
            field: "id",
            cell: readOnlyNumberCell,
            isId: true,
            hidden: true,
          },
          {
            field: "name",
            cell: createTextCell("player-name", t("common.name")),
            isEditable: true,
            href: (row) => `/players/${row.id}`,
          },
          {
            field: "fide_id",
            header: t("player.fideId"),
            cell: createTextCell("player-fide-id", t("player.fideId")),
            isEditable: true,
            hideBelow: "sm",
            // Players without a FIDE id have no profile to link to.
            href: (row) => (row.fide_id ? fideProfileUrl(row.fide_id) : null),
            external: true,
          },
          {
            field: "fide_rating",
            header: t("player.fideRating"),
            cell: readOnlyOptionalNumberCell,
            hideBelow: "sm",
          },
        ]}
        sort={(a, b) => a.name.localeCompare(b.name)}
        createConfig={createConfig}
        editConfig={{ validateData, sanitizeData, getRequestBody }}
        deleteConfig={{ getEntityName: (row) => row.name }}
      />
    </Stack>
  );
}
