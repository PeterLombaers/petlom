import { useState } from "react";
import { Group, Paper, Table, Text } from "@mantine/core";
import EditableRow from "./EditableRow";
import { CreateButton, CreateDialogConfig } from "./CreateButton";
import { AnyMutation, CellConfigs, DeleteConfig, EditConfig } from "./types";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { useAuth } from "@/auth";

type ColumnDef = {
  header: string;
  width?: string | number;
};

type CreateConfig = {
  entityType: string;
  mutation: AnyMutation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dialogConfig: CreateDialogConfig<any>;
};

type EditableTableProps<T extends object> = {
  rows: T[];
  getRowKey: (row: T) => string | number;
  entityIdField: keyof T;
  cells: CellConfigs<T>;
  columns: ColumnDef[];
  editConfig?: EditConfig<T>;
  deleteConfig?: DeleteConfig<T>;
  title?: React.ReactNode;
  createConfig?: CreateConfig;
  emptyMessage: string;
  actionsWidth?: number;
  isPending?: boolean;
  isError?: boolean;
  errorMessage?: string;
};

export default function EditableTable<T extends object>({
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
  isPending,
  isError,
  errorMessage,
}: EditableTableProps<T>) {
  const { isModerator } = useAuth();
  const [editableId, setEditableId] = useState<string | number | null>(null);

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={errorMessage ?? ""} />;

  const activeEditConfig = isModerator ? editConfig : undefined;
  const activeDeleteConfig = isModerator ? deleteConfig : undefined;
  const activeCreateConfig = isModerator ? createConfig : undefined;

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
