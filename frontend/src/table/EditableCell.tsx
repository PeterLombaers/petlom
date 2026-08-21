import { Table } from "@mantine/core";
import React from "react";
import type { EditProps } from "./types";

interface EditableCellProps<V = unknown, R = unknown> {
  isEditing: boolean;
  value: V;
  editValue: V;
  setEditValue: (editValue: V) => void;
  /** The row this cell belongs to, handed to `renderEdit`. */
  row: R;
  renderValue: (props: { value: V }) => React.ReactNode;
  renderEdit: (props: EditProps<V, R>) => React.ReactNode;
  error: string;
  className?: string;
}

export default function EditableCell<V = unknown, R = unknown>({
  isEditing,
  value,
  editValue,
  setEditValue,
  row,
  renderValue,
  renderEdit,
  error,
  className,
}: EditableCellProps<V, R>) {
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
            row,
          })
        : renderValue({ value })}
    </Table.Td>
  );
}
