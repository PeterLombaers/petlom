import { useState } from "react";
import { Group, Paper, Table, Text } from "@mantine/core";
import EditableRow from "./EditableRow";
import { CreateButton, CreateDialogConfig } from "./CreateButton";
import {
  CellConfigs,
  Column,
  DeleteConfig,
  EditConfig,
  TableQueryResult,
} from "./types";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { useAuth } from "@/auth";
import { formatHTTPValidationError } from "@/client/api";
import { pluralize } from "@/utils";

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
 *   CSS capitalisation), an optional fixed width, and a cell config with `renderValue`
 *   and optional `renderEdit`. Mark one column `isId: true` to identify the entity —
 *   its value becomes the React key and the mutation path parameter. Set `hidden: true`
 *   on the id column to keep it out of the rendered table (e.g. when the id is a
 *   database surrogate key with no display value).
 *
 * @param title - Overrides the default title shown in the table header. The default is
 *   `pluralize(entityType)` rendered with CSS `text-transform: capitalize`.
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
}: EditableTableProps<T>) {
  const { isModerator } = useAuth();
  const [editableId, setEditableId] = useState<string | number | null>(null);

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

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={formatHTTPValidationError(error)} />;

  const idColumn = columns.find((c) => c.isId)!;
  const entityIdField = idColumn.field;
  const getRowKey = (row: T) => row[entityIdField] as string | number;

  const visibleColumns = columns.filter((c) => !c.hidden);
  const cellConfigs = Object.fromEntries(
    visibleColumns.map((c) => [c.field, c.cell]),
  ) as CellConfigs<T>;

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

  const hasColgroup = visibleColumns.some((c) => c.width !== undefined);
  const nCols = visibleColumns.length + (activeEditConfig ? 1 : 0);
  const showCreate = isModerator && createConfig !== undefined;
  const tableTitle = title || pluralize(entityType);

  return (
    <Paper withBorder>
      <Table
        style={
          hasColgroup ? { tableLayout: "fixed", width: "100%" } : undefined
        }
      >
        {hasColgroup && (
          <colgroup>
            {visibleColumns.map((col, i) => (
              <col
                key={i}
                style={
                  col.width !== undefined ? { width: col.width } : undefined
                }
              />
            ))}
            {activeEditConfig && <col style={{ width: 100 }} />}
          </colgroup>
        )}
        <Table.Thead>
          <Table.Tr>
            <Table.Td colSpan={nCols}>
              <Group justify="space-between">
                <Text
                  style={title ? undefined : { textTransform: "capitalize" }}
                >
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
            {visibleColumns.map((col) => (
              <Table.Th
                key={String(col.field)}
                style={col.header ? undefined : { textTransform: "capitalize" }}
              >
                {col.header ?? String(col.field)}
              </Table.Th>
            ))}
            {activeEditConfig && <Table.Th>Actions</Table.Th>}
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
                  isEditing={editableId === key}
                  setIsEditing={(isEditing) =>
                    setEditableId(isEditing ? key : null)
                  }
                  cells={cellConfigs}
                  entityIdField={entityIdField}
                  editConfig={activeEditConfig}
                  deleteConfig={activeDeleteConfig}
                />
              );
            })
          ) : (
            <Table.Tr>
              <Table.Td colSpan={nCols} c="dimmed" ta="center">
                No {pluralize(entityType)} yet.
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
