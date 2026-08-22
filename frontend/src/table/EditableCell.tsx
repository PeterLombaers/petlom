import { Table } from "@mantine/core";
import React from "react";
import type { EditProps } from "./types";
import classes from "./EditableTable.module.css";

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
}: EditableCellProps<V, R>) {
  return (
    // The resting cell never wraps; an editing cell lets its control lay out.
    <Table.Td className={isEditing ? undefined : classes.cell}>
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
