import { Group, Table } from "@mantine/core";
import React, { useState } from "react";
import EditableCell from "./EditableCell";
import { EditButton } from "./EditButton";
import DeleteButton from "./DeleteButton";
import { AnyMutation } from "./types";

interface DeleteConfig<T = unknown> {
  deleteMutation: AnyMutation;
  entityType: string;
  entityNameField: keyof T;
  requireTypedConfirmation?: boolean;
}

interface EditConfig<T = unknown> {
  editMutation: AnyMutation;
  validateData: (editData: T) => Partial<Record<keyof T, string>>;
  sanitizeData: (editData: T) => T;
  getRequestBody: (editData: T) => unknown;
}

interface EditableRowProps<T = unknown> {
  data: T;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  cells: {
    [K in keyof T]?: {
      renderValue: (props: { value: T[K] }) => React.ReactNode;
      renderEdit?: (props: {
        editValue: T[K];
        error: string;
        onChange: (newValue: T[K]) => void;
      }) => React.ReactNode;
    };
  };
  entityIdField: keyof T;
  editConfig?: EditConfig<T>;
  deleteConfig?: DeleteConfig<T>;
}

export default function EditableRow<T = unknown>({
  data,
  isEditing,
  setIsEditing,
  cells,
  entityIdField,
  editConfig,
  deleteConfig,
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
            <EditButton
              isEditing={isEditing}
              isPending={editConfig.editMutation.isPending}
              onEdit={handleStartEdit}
              onSave={handleSave}
              onCancel={() => setIsEditing(false)}
            />
            {deleteConfig && (
              <DeleteButton
                entityType={deleteConfig.entityType}
                entityName={data[deleteConfig.entityNameField] as string}
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
