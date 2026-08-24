import { Button, Group, Menu, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowMerge } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";
import EditableTable from "@/table/EditableTable";
import { Column } from "@/table/types";
import {
  createNonEmptyStringValidator,
  createTextCell,
  readOnlyNumberCell,
  readOnlyOptionalNumberCell,
} from "@/table/cells";
import { createExternalIdCell } from "./cells";
import { EXTERNAL_SOURCES, externalProfileUrl } from "./external";
import MatchExternalIdsModal from "./MatchExternalIdsModal";
import MergePlayerModal from "./MergePlayerModal";
import { usePlayerCreateConfig } from "./playerCreateConfig";
import { useImportExternalRatings } from "./useImportExternalRatings";
import { PlayerRow, usePlayerRows } from "./usePlayerRows";

const sanitizeData = (row: PlayerRow) => ({
  ...row,
  name: row.name.trim(),
  fide_id: row.fide_id.trim(),
  knsb_id: row.knsb_id.trim(),
});
const getRequestBody = (row: PlayerRow) => ({
  name: row.name,
  fide_id: row.fide_id,
  knsb_id: row.knsb_id,
});

export default function PlayerTable() {
  const { t } = useTranslation();
  const { isModerator } = useAuth();
  const queryResult = usePlayerRows();
  const createConfig = usePlayerCreateConfig();
  const importMutation = useImportExternalRatings();
  const [matchModalOpened, { open: openMatchModal, close: closeMatchModal }] =
    useDisclosure(false);
  // One modal for the whole table, opened by the row whose merge icon was hit.
  const [mergeTarget, setMergeTarget] = useState<PlayerRow | null>(null);

  const validatePlayerName = createNonEmptyStringValidator(
    "name",
    t("common.valueRequired"),
  );

  const validateData = (row: PlayerRow) => {
    const errors: Record<string, string> = {};
    validatePlayerName(row.name, errors);
    return errors;
  };

  // Two columns per source: the id, editable, and the rating it was imported
  // with, which only an import can change.
  const externalColumns: Column<PlayerRow>[] = EXTERNAL_SOURCES.flatMap(
    (source) => {
      const sourceName = t(`externalSource.${source}`);
      return [
        {
          field: `${source}_id`,
          header: t("player.sourceId", { source: sourceName }),
          cell: createExternalIdCell(source),
          isEditable: true,
          // The search dropdown needs more room than the identifier itself.
          editWidth: 260,
          // Players without an id there have no profile to link to, and not
          // every source publishes one at all.
          href: (row) =>
            row[`${source}_id`]
              ? externalProfileUrl(source, row[`${source}_id`])
              : null,
          external: true,
        },
        {
          field: `${source}_rating`,
          header: t("player.sourceRating", { source: sourceName }),
          cell: readOnlyOptionalNumberCell,
        },
      ];
    },
  );

  return (
    <Stack>
      {isModerator && (
        <Group justify="flex-end">
          <Button onClick={openMatchModal}>
            {t("player.findIds")}
          </Button>
          {matchModalOpened && (
            <MatchExternalIdsModal onClose={closeMatchModal} />
          )}
          <Menu>
            <Menu.Target>
              <Button loading={importMutation.isPending}>
                {t("player.importRatings")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {EXTERNAL_SOURCES.map((source) => (
                <Menu.Item
                  key={source}
                  onClick={() =>
                    importMutation.mutate({
                      params: { path: { source } },
                      body: { update_existing: false },
                    })
                  }
                >
                  {t(`externalSource.${source}`)}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
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
          ...externalColumns,
        ]}
        sort={(a, b) => a.name.localeCompare(b.name)}
        createConfig={createConfig}
        editConfig={{ validateData, sanitizeData, getRequestBody }}
        deleteConfig={{ getEntityName: (row) => row.name }}
        rowActions={[
          {
            icon: <IconArrowMerge size={18} />,
            label: t("player.merge"),
            onClick: setMergeTarget,
          },
        ]}
      />
      {mergeTarget && (
        <MergePlayerModal
          player={mergeTarget}
          onClose={() => setMergeTarget(null)}
        />
      )}
    </Stack>
  );
}
