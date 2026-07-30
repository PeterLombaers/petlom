import { Table } from "@mantine/core";
import React from "react";
import type { EditProps } from "./types";

interface EditableCellProps<T = unknown> {
  isEditing: boolean;
  value: T;
  editValue: T;
  setEditValue: (editValue: T) => void;
  renderValue: (props: { value: T }) => React.ReactNode;
  renderEdit: (props: EditProps<T>) => React.ReactNode;
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
          : {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }
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
