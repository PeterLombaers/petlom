import { Anchor, Box, Group, Table } from "@mantine/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import EditableCell from "./EditableCell";
import { EditButton } from "./EditButton";
import DeleteButton from "./DeleteButton";
import { Column, DeleteConfig, EditConfig } from "./types";
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
        const href = col.href;
        const renderValue = href
          ? (props: { value: T[typeof key] }) =>
              col.external ? (
                <Anchor href={href(data)} target="_blank" rel="noreferrer">
                  {cell.renderValue(props)}
                </Anchor>
              ) : (
                <Anchor component={Link} to={href(data)}>
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
      {editConfig && (
        <Table.Td>
          <Group>
            {!hideRowEditButton && (
              <EditButton
                isEditing={isEditing}
                isPending={editConfig.editMutation.isPending}
                onEdit={handleStartEdit}
                onSave={handleSave}
                onCancel={handleCancelEdit}
              />
            )}
            {deleteConfig && !hideRowEditButton && (
              // Desktop shows delete on the resting row; mobile only has room
              // for it once the row is expanded into edit mode.
              <Box
                component="span"
                visibleFrom={isEditing ? undefined : "sm"}
                hiddenFrom={isEditing ? "sm" : undefined}
              >
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
              </Box>
            )}
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  );
}
