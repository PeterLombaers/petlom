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
  queryResult: TableQueryResult;
  entityType: string;
  rows: T[];
  columns: Column<T>[];
  editConfig?: TableEditConfig<T>;
  getEntityName?: (row: T) => string;
  requireTypedConfirmation?: boolean;
  title?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createDialogConfig?: CreateDialogConfig<any>;
  actionsWidth?: number;
};

export default function EditableTable<T extends object>({
  queryResult,
  entityType,
  rows,
  columns,
  editConfig,
  getEntityName,
  requireTypedConfirmation,
  title,
  createDialogConfig,
  actionsWidth,
}: EditableTableProps<T>) {
  const { isModerator } = useAuth();
  const [editableId, setEditableId] = useState<string | number | null>(null);

  const {
    isPending,
    isError,
    error,
    editMutation,
    deleteMutation,
    createMutation,
  } = queryResult;

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
      ? { getEntityName, entityType, deleteMutation, requireTypedConfirmation }
      : undefined;

  const hasColgroup =
    visibleColumns.some((c) => c.width !== undefined) ||
    actionsWidth !== undefined;
  const nCols = visibleColumns.length + (activeEditConfig ? 1 : 0);
  const showCreate = isModerator && createDialogConfig !== undefined;
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
            {activeEditConfig && (
              <col
                style={
                  actionsWidth !== undefined
                    ? { width: actionsWidth }
                    : undefined
                }
              />
            )}
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
                    dialogConfig={createDialogConfig}
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
