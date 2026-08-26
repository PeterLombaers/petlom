import { useState } from "react";
import { describeError } from "@/ui/notify";
import type { EditConfig } from "./types";

export type RowKey = string | number;

type UseTableEditStateArgs<T> = {
  /** Rows in display order — the set column edit operates on. */
  rows: T[];
  getRowKey: (row: T) => RowKey;
  /** Field whose value becomes the mutation path parameter. */
  entityIdField: keyof T;
  /**
   * The resolved edit config (mutation included), or `undefined` when editing is
   * unavailable — `saveColumnEdit` then does nothing.
   */
  editConfig?: EditConfig<T>;
  /** Rows this returns `false` for take no part in column edit. */
  isRowEditable?: (row: T) => boolean;
};

export type TableEditState<T> = {
  /** Key of the row in row-edit mode, or `null`. */
  editableRowKey: RowKey | null;
  startRowEdit: (rowKey: RowKey) => void;
  stopRowEdit: () => void;
  /** Field in column-edit mode, or `null`. */
  columnEditField: keyof T | null;
  isColumnEditing: boolean;
  columnEditValues: Map<RowKey, unknown>;
  columnEditErrors: Map<RowKey, string>;
  startColumnEdit: (field: keyof T) => void;
  changeColumnEditValue: (rowKey: RowKey, newValue: unknown) => void;
  cancelColumnEdit: () => void;
  saveColumnEdit: () => Promise<void>;
};

/**
 * Owns an EditableTable's two mutually exclusive edit modes: one row across all its
 * fields, or one field across all rows.
 *
 * Keeping both in a single hook makes the exclusion an invariant rather than a side
 * effect the caller has to remember — `startRowEdit` discards any column edit in
 * progress and `startColumnEdit` discards any row edit.
 *
 * Row edit is only tracked here (which row is open); the buffered values and per-field
 * errors for it live in `EditableRow`, which reads untouched fields straight from the
 * latest data. Column edit buffers here instead, because saving it spans every row.
 */
export function useTableEditState<T extends object>({
  rows,
  getRowKey,
  entityIdField,
  editConfig,
  isRowEditable,
}: UseTableEditStateArgs<T>): TableEditState<T> {
  // Column edit spans "every row", which means every row it is allowed to
  // touch: a frozen one is excluded from the buffer, the validation and the
  // save alike, so it can never be counted as changed.
  const editableRows = isRowEditable ? rows.filter(isRowEditable) : rows;
  const [editableRowKey, setEditableRowKey] = useState<RowKey | null>(null);
  const [columnEditField, setColumnEditField] = useState<keyof T | null>(null);
  const [columnEditValues, setColumnEditValues] = useState<
    Map<RowKey, unknown>
  >(new Map());
  const [columnEditErrors, setColumnEditErrors] = useState<Map<RowKey, string>>(
    new Map(),
  );

  const clearColumnEdit = () => {
    setColumnEditField(null);
    setColumnEditValues(new Map());
    setColumnEditErrors(new Map());
  };

  const startRowEdit = (rowKey: RowKey) => {
    clearColumnEdit();
    setEditableRowKey(rowKey);
  };

  const stopRowEdit = () => setEditableRowKey(null);

  const startColumnEdit = (field: keyof T) => {
    setEditableRowKey(null);
    setColumnEditField(field);
    setColumnEditValues(
      new Map(editableRows.map((row) => [getRowKey(row), row[field]])),
    );
    setColumnEditErrors(new Map());
  };

  const changeColumnEditValue = (rowKey: RowKey, newValue: unknown) => {
    setColumnEditValues((prev) => new Map(prev).set(rowKey, newValue));
    setColumnEditErrors((prev) => {
      const next = new Map(prev);
      next.delete(rowKey);
      return next;
    });
  };

  const saveColumnEdit = async () => {
    if (!columnEditField || !editConfig) return;
    const { editMutation, validateData, sanitizeData, getRequestBody } =
      editConfig;

    const editedRow = (row: T) =>
      ({
        ...row,
        [columnEditField]: columnEditValues.get(getRowKey(row)),
      }) as T;

    const validationErrors = new Map<RowKey, string>();
    editableRows.forEach((row) => {
      const err = validateData(sanitizeData(editedRow(row)))[columnEditField];
      if (err) validationErrors.set(getRowKey(row), err);
    });
    if (validationErrors.size > 0) {
      setColumnEditErrors(validationErrors);
      return;
    }

    const changedRows = editableRows.filter(
      (row) => columnEditValues.get(getRowKey(row)) !== row[columnEditField],
    );

    // `allSettled` rather than `all`: a partial failure must report which rows
    // failed, otherwise the user is left with some rows saved and some not and no
    // way to tell them apart.
    const results = await Promise.allSettled(
      changedRows.map((row) =>
        editMutation.mutateAsync({
          body: getRequestBody(sanitizeData(editedRow(row))),
          params: { path: { [String(entityIdField)]: getRowKey(row) } },
        }),
      ),
    );

    const saveErrors = new Map<RowKey, string>();
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        saveErrors.set(getRowKey(changedRows[i]), describeError(result.reason));
      }
    });
    // Stay in column edit mode when any row failed, so the failed values are not
    // lost and the errors stay visible next to them.
    if (saveErrors.size > 0) {
      setColumnEditErrors(saveErrors);
      return;
    }
    clearColumnEdit();
  };

  return {
    editableRowKey,
    startRowEdit,
    stopRowEdit,
    columnEditField,
    isColumnEditing: columnEditField !== null,
    columnEditValues,
    columnEditErrors,
    startColumnEdit,
    changeColumnEditValue,
    cancelColumnEdit: clearColumnEdit,
    saveColumnEdit,
  };
}
