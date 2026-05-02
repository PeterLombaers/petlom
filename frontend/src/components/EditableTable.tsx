import { useState } from "react";
import { Group, Paper, Table, Text } from "@mantine/core";
import EditableRow from "./EditableRow";
import { CreateButton, CreateDialogConfig } from "./CreateButton";
import {
  CellConfigs,
  DeleteConfig,
  EditConfig,
  TableQueryResult,
} from "./types";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { useAuth } from "@/auth";
import { formatHTTPValidationError } from "@/client/api";

type ColumnDef = {
  header: string;
  width?: string | number;
};

type TableEditConfig<T> = Omit<EditConfig<T>, "editMutation">;

type EditableTableProps<T extends object> = {
  queryResult: TableQueryResult;
  entityType: string;
  rows: T[];
  getRowKey: (row: T) => string | number;
  entityIdField: keyof T;
  cells: CellConfigs<T>;
  columns: ColumnDef[];
  editConfig?: TableEditConfig<T>;
  getEntityName?: (row: T) => string;
  requireTypedConfirmation?: boolean;
  title?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createDialogConfig?: CreateDialogConfig<any>;
  actionsWidth?: number;
};

function pluralize(noun: string): string {
  // words ending in s, x, z, ch, sh → add "es"
  if (/(s|x|z|ch|sh)$/i.test(noun)) {
    return noun + "es";
  }

  // words ending in consonant + y → replace "y" with "ies"
  if (/[bcdfghjklmnpqrstvwxyz]y$/i.test(noun)) {
    return noun.replace(/y$/i, "ies");
  }

  // words ending in "f" or "fe" → replace with "ves"
  if (/(f|fe)$/i.test(noun)) {
    return noun.replace(/(f|fe)$/i, "ves");
  }

  // default → add "s"
  return noun + "s";
}

export default function EditableTable<T extends object>({
  queryResult,
  entityType,
  rows,
  getRowKey,
  entityIdField,
  cells,
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

  const activeEditConfig: EditConfig<T> | undefined =
    isModerator && editConfig ? { ...editConfig, editMutation } : undefined;
  const activeDeleteConfig: DeleteConfig<T> | undefined =
    isModerator && getEntityName
      ? { getEntityName, entityType, deleteMutation, requireTypedConfirmation }
      : undefined;

  const hasColgroup =
    columns.some((c) => c.width !== undefined) || actionsWidth !== undefined;
  const nCols = columns.length + (activeEditConfig ? 1 : 0);
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
            {columns.map((col, i) => (
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
                <Text>{tableTitle}</Text>
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
            {columns.map((col) => (
              <Table.Th key={col.header}>{col.header}</Table.Th>
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
                  cells={cells}
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
