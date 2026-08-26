import { ActionIcon, Anchor, Group, Table } from "@mantine/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import EditableCell from "./EditableCell";
import { EditButton } from "./EditButton";
import DeleteButton from "./DeleteButton";
import { notifyError } from "@/ui/notify";
import { Column, DeleteConfig, EditConfig, RowAction } from "./types";
import classes from "./EditableTable.module.css";

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
  /**
   * `false` for a row whose data is frozen: no Edit button, but Delete and row
   * actions stay, so the Actions cell keeps its other buttons.
   */
  isEditable?: boolean;
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
  isEditable = true,
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
        // The edit mutation is `silent` for the sake of column edit, which shows
        // a per-row error instead; a row edit has nowhere else to put it.
        onError: notifyError,
      },
    );
  };

  return (
    <Table.Tr>
      {columns.map((col) => {
        const key: keyof T = col.field;
        const cell = col.cell!;
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
            />
          );
        }
        return (
          <Table.Td key={String(key)} className={classes.cell}>
            {renderValue({ value: data[key] })}
          </Table.Td>
        );
      })}
      {hasActions && (
        <Table.Td className={classes.cell}>
          <Group gap="xs" wrap="nowrap">
            {editConfig && isEditable && !hideRowEditButton && (
              <EditButton
                isEditing={isEditing}
                isPending={editConfig.editMutation.isPending}
                onEdit={handleStartEdit}
                onSave={handleSave}
                onCancel={handleCancelEdit}
              />
            )}
            {deleteConfig && !hideRowEditButton && (
              <DeleteButton
                entityType={deleteConfig.entityType}
                entityName={deleteConfig.getEntityName(data)}
                entityIdField={String(entityIdField)}
                entityId={entityId}
                mutation={deleteConfig.deleteMutation}
                requireTypedConfirmation={deleteConfig.requireTypedConfirmation}
              />
            )}
            {!hideRowEditButton &&
              rowActions?.map((action) => (
                <ActionIcon
                  key={action.label}
                  onClick={() => action.onClick(data)}
                  disabled={action.isPending}
                  aria-label={action.label}
                >
                  {action.icon}
                </ActionIcon>
              ))}
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  );
}
