import { TableCell } from "@mui/material";
import React from "react";

interface EditableCellProps<T = any> {
  isEditing: boolean;
  value: T;
  editValue: T;
  setEditValue: (editValue: T) => void;
  renderValue: (props: { value: T }) => React.ReactNode;
  renderEdit: (props: {
    editValue: T;
    error: string;
    onChange: (newValue: T) => void;
  }) => React.ReactNode;
  error: string;
}

export default function EditableCell<T = any>({
  isEditing,
  value,
  editValue,
  setEditValue,
  renderValue,
  renderEdit,
  error,
}: EditableCellProps<T>) {
  return (
    <TableCell>
      {isEditing
        ? renderEdit({
            editValue,
            error,
            onChange: setEditValue,
          })
        : renderValue({ value })}
    </TableCell>
  );
}
