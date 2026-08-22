import { ActionIcon, Anchor, Box, Group, Table } from "@mantine/core";
import type { MantineBreakpoint } from "@mantine/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import EditableCell from "./EditableCell";
import { EditButton } from "./EditButton";
import DeleteButton from "./DeleteButton";
import { Column, DeleteConfig, EditConfig, RowAction } from "./types";
import { visibleFromClass } from "./responsive";

interface EditableRowProps<T = unknown> {
  data: T;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  /** Visible columns in display order; each one must carry a `cell` config. */
  columns: Column<T>[];
  entityIdField: keyof T;
  editConfig?: EditConfig<T>;
  deleteConfig?: DeleteConfig<T>;
  /** Domain actions for the actions cell, rendered after the built-in ones. */
  rowActions?: RowAction<T>[];
  columnEditField?: keyof T | null;
  columnEditValue?: unknown;
  columnEditError?: string;
  onColumnEditChange?: (newValue: unknown) => void;
  hideRowEditButton?: boolean;
}

export default function EditableRow<T = unknown>({
  data,
  isEditing,
  setIsEditing,
  columns,
  entityIdField,
  editConfig,
  deleteConfig,
  rowActions,
  columnEditField,
  columnEditValue,
  columnEditError,
  onColumnEditChange,
  hideRowEditButton,
}: EditableRowProps<T>) {
  // Only the fields the user actually touched are buffered; everything else is
  // read from the latest `data`, so a background refetch during an edit does
  // not get written back with stale values on save.
  const [edits, setEdits] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const editData = { ...data, ...edits };

  const setCellEditData = <K extends keyof T>(field: K, value: T[K]) => {
    setEdits((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const handleStartEdit = () => {
    setEdits({});
    setErrors({});
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEdits({});
    setErrors({});
    setIsEditing(false);
  };

  const entityId = data[entityIdField] as string | number;
  const hasActions = Boolean(editConfig || rowActions?.length);

  const handleSave = () => {
    if (!editConfig) return;
    const { editMutation, validateData, sanitizeData, getRequestBody } =
      editConfig;
    const sanitizedData = sanitizeData(editData);
    const dataErrors = validateData(sanitizedData);
    if (Object.keys(dataErrors).length > 0) {
      setErrors(dataErrors);
      return;
    }
    const requestBody = getRequestBody(sanitizedData);
    editMutation.mutate(
      {
        body: requestBody,
        params: { path: { [String(entityIdField)]: entityId } },
      },
      {
        onSuccess: () => {
          setEdits({});
          setIsEditing(false);
        },
      },
    );
  };

  return (
    <Table.Tr>
      {columns.map((col) => {
        const key: keyof T = col.field;
        const cell = col.cell!;
        const className = visibleFromClass(col.hideBelow);
        // Only the display path is linked; edit controls stay plain.
        const target = col.href?.(data) ?? null;
        const renderValue = target
          ? (props: { value: T[typeof key] }) =>
              col.external ? (
                <Anchor href={target} target="_blank" rel="noreferrer">
                  {cell.renderValue(props)}
                </Anchor>
              ) : (
                <Anchor component={Link} to={target}>
                  {cell.renderValue(props)}
                </Anchor>
              )
          : cell.renderValue;
        if (columnEditField === key && cell.renderEdit) {
          return (
            <EditableCell
              key={String(key)}
              isEditing={true}
              value={data[key]}
              editValue={columnEditValue as T[typeof key]}
              setEditValue={(newValue) => onColumnEditChange?.(newValue)}
              row={data}
              renderValue={renderValue}
              renderEdit={cell.renderEdit}
              error={columnEditError ?? ""}
              className={className}
            />
          );
        }
        if (cell.renderEdit) {
          return (
            <EditableCell
              key={String(key)}
              isEditing={isEditing}
              value={data[key]}
              editValue={editData[key]}
              setEditValue={(newValue) => setCellEditData(key, newValue)}
              // The row as it will be saved, so a cell that reads a sibling
              // field sees the edit in progress rather than the fetched value.
              row={editData}
              renderValue={renderValue}
              renderEdit={cell.renderEdit}
              error={errors[key] || ""}
              className={className}
            />
          );
        }
        return (
          <Table.Td
            key={String(key)}
            className={className}
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {renderValue({ value: data[key] })}
          </Table.Td>
        );
      })}
      {hasActions && (
        <Table.Td>
          <Group>
            {editConfig && !hideRowEditButton && (
              <EditButton
                isEditing={isEditing}
                isPending={editConfig.editMutation.isPending}
                onEdit={handleStartEdit}
                onSave={handleSave}
                onCancel={handleCancelEdit}
              />
            )}
            {deleteConfig && !hideRowEditButton && (
              <NarrowScreenAction hideBelow="sm" isEditing={isEditing}>
                <DeleteButton
                  entityType={deleteConfig.entityType}
                  entityName={deleteConfig.getEntityName(data)}
                  entityIdField={String(entityIdField)}
                  entityId={entityId}
                  mutation={deleteConfig.deleteMutation}
                  requireTypedConfirmation={
                    deleteConfig.requireTypedConfirmation
                  }
                />
              </NarrowScreenAction>
            )}
            {!hideRowEditButton &&
              rowActions?.map((action) => (
                <NarrowScreenAction
                  key={action.label}
                  hideBelow={action.hideBelow}
                  isEditing={isEditing}
                >
                  <ActionIcon
                    onClick={() => action.onClick(data)}
                    disabled={action.isPending}
                    aria-label={action.label}
                  >
                    {action.icon}
                  </ActionIcon>
                </NarrowScreenAction>
              ))}
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  );
}

/**
 * Gives an action the row's narrow-screen rule.
 *
 * At or above the breakpoint the action sits on the resting row; below it there
 * is only room for it once the row is expanded into edit mode. Without a
 * breakpoint the action is always shown.
 */
function NarrowScreenAction({
  hideBelow,
  isEditing,
  children,
}: {
  hideBelow?: MantineBreakpoint;
  isEditing: boolean;
  children: React.ReactNode;
}) {
  if (!hideBelow) return <>{children}</>;
  return (
    <Box
      component="span"
      visibleFrom={isEditing ? undefined : hideBelow}
      hiddenFrom={isEditing ? hideBelow : undefined}
    >
      {children}
    </Box>
  );
}
