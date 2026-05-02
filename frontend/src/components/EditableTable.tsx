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

// EditableTable-specific configs: mutations come from queryResult, not here.
type TableEditConfig<T> = Omit<EditConfig<T>, "editMutation">;
type TableDeleteConfig<T> = Omit<DeleteConfig<T>, "deleteMutation">;
type TableCreateConfig = {
  entityType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dialogConfig: CreateDialogConfig<any>;
};

type EditableTableProps<T extends object> = {
  queryResult: TableQueryResult;
  rows: T[];
  getRowKey: (row: T) => string | number;
  entityIdField: keyof T;
  cells: CellConfigs<T>;
  columns: ColumnDef[];
  editConfig?: TableEditConfig<T>;
  deleteConfig?: TableDeleteConfig<T>;
  title?: React.ReactNode;
  createConfig?: TableCreateConfig;
  emptyMessage: string;
  actionsWidth?: number;
};

export default function EditableTable<T extends object>({
  queryResult,
  rows,
  getRowKey,
  entityIdField,
  cells,
  columns,
  editConfig,
  deleteConfig,
  title,
  createConfig,
  emptyMessage,
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
    isModerator && deleteConfig
      ? { ...deleteConfig, deleteMutation }
      : undefined;
  const activeCreateConfig =
    isModerator && createConfig
      ? { ...createConfig, mutation: createMutation }
      : undefined;

  const hasColgroup =
    columns.some((c) => c.width !== undefined) || actionsWidth !== undefined;
  const nCols = columns.length + (activeEditConfig ? 1 : 0);
  const showTitleBar = title !== undefined || activeCreateConfig !== undefined;

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
          {showTitleBar && (
            <Table.Tr>
              <Table.Td colSpan={nCols}>
                <Group justify="space-between">
                  <Text>{title}</Text>
                  {activeCreateConfig && (
                    <CreateButton
                      entityType={activeCreateConfig.entityType}
                      mutation={activeCreateConfig.mutation}
                      dialogConfig={activeCreateConfig.dialogConfig}
                    />
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          )}
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
                {emptyMessage}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
