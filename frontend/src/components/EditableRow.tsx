import { Group, Table } from "@mantine/core";
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
  entityIdField,
  editConfig,
  deleteConfig,
  columnEditField,
  columnEditValue,
  columnEditError,
  onColumnEditChange,
  hideRowEditButton,
}: EditableRowProps<T>) {
  const [editData, setEditData] = useState<T>({ ...data });
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const setCellEditData = <K extends keyof T>(field: K, value: T[K]) => {
    setEditData({ ...editData, [field]: value });
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const handleStartEdit = () => {
    setEditData({ ...data });
    setErrors({});
    setIsEditing(true);
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
          setIsEditing(false);
        },
      },
    );
  };

  return (
    <Table.Tr>
      {(Object.keys(cells) as Array<keyof T>).map((key) => {
        const cell = cells[key]!;
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
            />
          );
        }
        return (
          <Table.Td key={String(key)}>
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
                onCancel={() => setIsEditing(false)}
              />
            )}
            {deleteConfig && !isEditing && !hideRowEditButton && (
              <DeleteButton
                entityType={deleteConfig.entityType}
                entityName={deleteConfig.getEntityName(data)}
                entityId={entityId}
                mutation={deleteConfig.deleteMutation}
                requireTypedConfirmation={deleteConfig.requireTypedConfirmation}
              />
            )}
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  );
}
