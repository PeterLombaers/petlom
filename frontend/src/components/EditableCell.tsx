import { Table } from "@mantine/core";
import React from "react";

interface EditableCellProps<T = unknown> {
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
  className?: string;
}

export default function EditableCell<T = unknown>({
  isEditing,
  value,
  editValue,
  setEditValue,
  renderValue,
  renderEdit,
  error,
  className,
}: EditableCellProps<T>) {
  return (
    <Table.Td
      className={className}
      style={
        isEditing
          ? undefined
          : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
      }
    >
      {isEditing
        ? renderEdit({
            editValue,
            error,
            onChange: setEditValue,
          })
        : renderValue({ value })}
    </Table.Td>
  );
}
