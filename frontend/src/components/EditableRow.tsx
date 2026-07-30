import { Box, Group, Table } from "@mantine/core";
import { useState } from "react";
import EditableCell from "./EditableCell";
import { EditButton } from "./EditButton";
import DeleteButton from "./DeleteButton";
import { CellConfigs, DeleteConfig, EditConfig } from "./types";

interface EditableRowProps<T = unknown> {
  data: T;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  cells: CellConfigs<T>;
  cellClasses?: Partial<Record<keyof T, string | undefined>>;
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
  cells,
  cellClasses,
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
      {(Object.keys(cells) as Array<keyof T>).map((key) => {
        const cell = cells[key]!;
        const className = cellClasses?.[key];
        if (columnEditField === key && cell.renderEdit) {
          return (
            <EditableCell
              key={String(key)}
              isEditing={true}
              value={data[key]}
              editValue={columnEditValue as T[typeof key]}
              setEditValue={(newValue) => onColumnEditChange?.(newValue)}
              renderValue={cell.renderValue}
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
              renderValue={cell.renderValue}
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
            {cell.renderValue({ value: data[key] })}
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
            {deleteConfig && !hideRowEditButton && !isEditing && (
              <Box visibleFrom="sm" component="span">
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
            {deleteConfig && !hideRowEditButton && isEditing && (
              <Box hiddenFrom="sm" component="span">
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
