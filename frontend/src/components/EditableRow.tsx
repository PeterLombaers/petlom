import { Stack, TableCell, TableRow } from "@mui/material";
import { UseMutationResult } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import EditableCell from "./EditableCell";
import { EditButton } from "./EditButton";
import DeleteButton from "./DeleteButton";

interface DeleteConfig<T = any> {
  deleteMutation: UseMutationResult<any, any, any, any>;
  entityType: string;
  entityNameField: keyof T;
  requireTypedConfirmation?: boolean;
}

interface EditConfig<T = any> {
  editMutation: UseMutationResult<any, any, any, any>;
  validateData: (editData: T) => Partial<Record<keyof T, string>>;
  sanitizeData: (editData: T) => T;
  getRequestBody: (editData: T) => any;
}

interface EditableRowProps<T = any> {
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
  editConfig: EditConfig<T>;
  deleteConfig?: DeleteConfig<T>;
}

export default function EditableRow<T = any>({
  data,
  isEditing,
  setIsEditing,
  cells,
  entityIdField,
  editConfig: { editMutation, validateData, sanitizeData, getRequestBody },
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

  useEffect(() => {
    if (!isEditing) {
      setEditData({ ...data });
      setErrors({});
    }
  }, [data, isEditing]);

  const entityId = data[entityIdField] as string | number;

  const handleSave = () => {
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
      }
    );
  };

  return (
    <TableRow>
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
          <TableCell key={String(key)}>
            {cell.renderValue({ value: data[key] })}
          </TableCell>
        );
      })}
      <TableCell>
        <Stack direction="row" justifyContent="flex-end">
          <EditButton
            isEditing={isEditing}
            isPending={editMutation.isPending}
            onEdit={() => setIsEditing(true)}
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
        </Stack>
      </TableCell>
    </TableRow>
  );
}
