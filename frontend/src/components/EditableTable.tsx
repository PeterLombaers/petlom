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

type EditableTableProps<T extends object> = {
  queryResult: TableQueryResult<T>;
  entityType: string;
  columns: Column<T>[];
  title?: string;
  sort?: (a: T, b: T) => number;
  getEntityName?: (row: T) => string;
  // The generic type of the create dialog is the type of the submit form data. The
  // table doesn't need to know the type but simply passes it on to CreateButton, so we
  // put an `any` type here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createConfig?: CreateDialogConfig<any>;
  editConfig?: TableEditConfig<T>;
  typedDeleteConfirmation?: boolean;
};

export default function EditableTable<T extends object>({
  queryResult,
  entityType,
  columns,
  title,
  sort,
  getEntityName,
  createConfig,
  editConfig,
  typedDeleteConfirmation,
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
    isModerator && getEntityName
      ? {
          getEntityName,
          entityType,
          deleteMutation,
          requireTypedConfirmation: typedDeleteConfirmation,
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
