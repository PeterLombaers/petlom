import { Group, Paper, Table, Text } from "@mantine/core";
import EditableRow from "./EditableRow";
import { EditButton } from "./EditButton";
import { CreateButton, CreateDialogConfig } from "./CreateButton";
import {
  Column,
  DeleteConfig,
  EditConfig,
  RowAction,
  TableQueryResult,
} from "./types";
import { LoadingState } from "@/ui/LoadingState";
import { ErrorState } from "@/ui/ErrorState";
import { useAuth } from "@/auth";
import { formatHTTPValidationError } from "@/client/api";
import { translateEntity } from "@/i18n/translateEntity";
import { useTranslation } from "react-i18next";
import { useTableEditState } from "./useTableEditState";
import classes from "./EditableTable.module.css";

type TableEditConfig<T> = Omit<EditConfig<T>, "editMutation">;
type TableDeleteConfig<T> = Omit<
  DeleteConfig<T>,
  "deleteMutation" | "entityType"
>;

type EditableTableProps<T extends object> = {
  queryResult: TableQueryResult<T>;
  entityType: string;
  columns: Column<T>[];
  title?: string;
  sort?: (a: T, b: T) => number;
  // The generic type of the create dialog is the type of the submit form data. The
  // table doesn't need to know the type but simply passes it on to CreateButton, so we
  // put an `any` type here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createConfig?: CreateDialogConfig<any>;
  editConfig?: TableEditConfig<T>;
  deleteConfig?: TableDeleteConfig<T>;
  rowActions?: RowAction<T>[];
};

/**
 * Generic data table with optional inline editing, row deletion, and entity creation.
 *
 * @param queryResult - Direct output of a data hook (e.g. `usePlayers()`). Drives
 *   loading/error states and supplies the three mutations. Contains `rows`, which is
 *   the raw unordered data array.
 *
 * @param entityType - Singular lowercase name for the entity, e.g. `"player"`. Used as
 *   the default table title (pluralised), in the empty-state message ("No players
 *   yet."), and in create/delete button labels.
 *
 * @param columns - Full column definitions in display order. Each entry carries the
 *   field name (typed against `T`), an optional header (defaults to the field name with
 *   CSS capitalisation), an optional width hint, and a cell config with `renderValue`
 *   and optional `renderEdit`. Mark one column `isId: true` to identify the entity —
 *   its value becomes the React key and the mutation path parameter. Set `hidden: true`
 *   on the id column to keep it out of the rendered table (e.g. when the id is a
 *   database surrogate key with no display value).
 *
 * @param title - Overrides the default title shown in the table header. The default is
 *   the plural of entityType rendered with CSS `text-transform: capitalize`.
 *
 * @param sort - Optional comparator passed to `Array.sort` on the raw rows before
 *   rendering. Omit to preserve the API order.
 *
 * @param createConfig - Enables the Add button for moderators. The dialog config drives
 *   the create form (initial values, validation, rendering, and request body). When
 *   absent, no Add button is rendered.
 *
 * @param editConfig - Enables inline row editing for moderators. Provides
 *   `validateData`, `sanitizeData`, and `getRequestBody`. When absent, no Edit button
 *   is rendered and the Actions column is hidden entirely.
 *
 * @param deleteConfig - Enables the Delete button for moderators. `getEntityName`
 *   returns the display name shown in the confirmation dialog. Set `typedConfirmation`
 *   to `false` to skip requiring the user to type the name (defaults to `true`). When
 *   absent, no Delete button is rendered.
 *
 * @param rowActions - Moderator-only domain actions for the Actions column, rendered
 *   after the built-in ones. Use them for what the engine cannot describe with
 *   primitives (e.g. merging two players, which needs a player picker). The table
 *   renders the buttons; each action supplies an icon, a label and an `onClick` that
 *   receives the row, and the caller mounts whatever dialog the action opens.
 */

export default function EditableTable<T extends object>({
  queryResult,
  entityType,
  columns,
  title,
  sort,
  deleteConfig,
  createConfig,
  editConfig,
  rowActions,
}: EditableTableProps<T>) {
  const { isModerator } = useAuth();
  const { t } = useTranslation();

  const {
    rows: rawRows,
    isPending,
    isError,
    error,
    editMutation,
    deleteMutation,
    createMutation,
  } = queryResult;

  const rows = sort ? [...(rawRows ?? [])].sort(sort) : (rawRows ?? []);

  const idColumn = columns.find((c) => c.isId)!;
  const entityIdField = idColumn.field;
  const getRowKey = (row: T) => row[entityIdField] as string | number;

  const activeEditConfig: EditConfig<T> | undefined =
    isModerator && editConfig ? { ...editConfig, editMutation } : undefined;
  const activeDeleteConfig: DeleteConfig<T> | undefined =
    isModerator && deleteConfig
      ? {
          getEntityName: deleteConfig.getEntityName,
          entityType,
          deleteMutation,
          requireTypedConfirmation: deleteConfig.requireTypedConfirmation,
        }
      : undefined;
  const activeRowActions = isModerator ? rowActions : undefined;

  const edit = useTableEditState<T>({
    rows,
    getRowKey,
    entityIdField,
    editConfig: activeEditConfig,
  });

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={formatHTTPValidationError(error)} />;

  const visibleColumns = columns.filter((c) => !c.hidden);

  const colWidth = (col: (typeof visibleColumns)[number]) =>
    edit.columnEditField === col.field && col.editWidth !== undefined
      ? col.editWidth
      : col.width;
  // The Actions column exists as soon as something can be rendered in it.
  const hasActions = Boolean(activeEditConfig || activeRowActions?.length);
  const nCols = visibleColumns.length + (hasActions ? 1 : 0);
  const showCreate = isModerator && createConfig !== undefined;
  const tableTitle = title || translateEntity(t, entityType, true);

  const table = (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Td colSpan={nCols}>
            <Group justify="space-between">
              <Text style={title ? undefined : { textTransform: "capitalize" }}>
                {tableTitle}
              </Text>
              {showCreate && (
                <CreateButton
                  entityType={entityType}
                  mutation={createMutation}
                  dialogConfig={createConfig}
                />
              )}
            </Group>
          </Table.Td>
        </Table.Tr>
        <Table.Tr>
          {visibleColumns.map((col) => {
            const isThisColumnEditing = edit.columnEditField === col.field;
            const showColumnEditButton =
              activeEditConfig &&
              col.isEditable &&
              (!edit.isColumnEditing || isThisColumnEditing);
            return (
              <Table.Th
                key={String(col.field)}
                scope="col"
                // A header width sizes the whole column under automatic layout.
                w={colWidth(col)}
                style={col.header ? undefined : { textTransform: "capitalize" }}
              >
                <Group gap="xs" wrap="nowrap">
                  <span>{col.header ?? String(col.field)}</span>
                  {showColumnEditButton && (
                    <EditButton
                      isEditing={isThisColumnEditing}
                      isPending={activeEditConfig!.editMutation.isPending}
                      onEdit={() => edit.startColumnEdit(col.field)}
                      onSave={edit.saveColumnEdit}
                      onCancel={edit.cancelColumnEdit}
                    />
                  )}
                </Group>
              </Table.Th>
            );
          })}
          {hasActions && (
            // Shrink-to-fit: the column ends up exactly as wide as its icons.
            <Table.Th scope="col" w="1%" className={classes.cell}>
              {t("common.actions")}
            </Table.Th>
          )}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.length > 0 ? (
          rows.map((row) => {
            const key = getRowKey(row);
            return (
              <EditableRow<T>
                key={key}
                data={row}
                isEditing={edit.editableRowKey === key}
                setIsEditing={(isEditing) =>
                  isEditing ? edit.startRowEdit(key) : edit.stopRowEdit()
                }
                columns={visibleColumns}
                entityIdField={entityIdField}
                editConfig={activeEditConfig}
                deleteConfig={activeDeleteConfig}
                rowActions={activeRowActions}
                columnEditField={edit.columnEditField}
                columnEditValue={edit.columnEditValues.get(key)}
                columnEditError={edit.columnEditErrors.get(key) ?? ""}
                onColumnEditChange={(newValue) =>
                  edit.changeColumnEditValue(key, newValue)
                }
                hideRowEditButton={edit.isColumnEditing}
              />
            );
          })
        ) : (
          <Table.Tr>
            <Table.Td colSpan={nCols} c="dimmed" ta="center">
              {t("table.noEntitiesYet", {
                entityType: translateEntity(t, entityType, true),
              })}
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );

  const isBusy =
    editMutation.isPending ||
    deleteMutation.isPending ||
    createMutation.isPending;

  return (
    <Paper withBorder aria-busy={isBusy}>
      <Table.ScrollContainer minWidth={0} type="native">
        {table}
      </Table.ScrollContainer>
    </Paper>
  );
}
