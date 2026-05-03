import React from "react";
import { UseMutationResult } from "@tanstack/react-query";
import type { components } from "@client/schema";

// Wildcard mutation type for components that only use .isPending and .mutate().
// `any` on the type params is intentional: it lets callers pass any concretely-typed
// mutation without the component needing to be generic over the full mutation type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMutation = UseMutationResult<any, any, any, any>;

export interface DeleteConfig<T = unknown> {
  deleteMutation: AnyMutation;
  entityType: string;
  getEntityName: (data: T) => string;
  requireTypedConfirmation?: boolean;
}

export interface EditConfig<T = unknown> {
  editMutation: AnyMutation;
  validateData: (editData: T) => Partial<Record<keyof T, string>>;
  sanitizeData: (editData: T) => T;
  getRequestBody: (editData: T) => unknown;
}

export type CellConfig<T, K extends keyof T> = {
  renderValue: (props: { value: T[K] }) => React.ReactNode;
  renderEdit?: (props: {
    editValue: T[K];
    error: string;
    onChange: (newValue: T[K]) => void;
  }) => React.ReactNode;
};

export type CellConfigs<T> = { [K in keyof T]?: CellConfig<T, K> };

/**
 * Defines a single column in an EditableTable.
 *
 * The distributive mapped type ensures `field` and `cell` are always typed
 * against the same key `K` of `T`, so TypeScript catches mismatches between
 * the field name and the cell's value type.
 *
 * @property field  - The key of `T` this column reads from.
 *
 * @property cell   - Render config for the cell. Required for visible columns;
 *   omit for hidden columns. `renderValue` is always required; `renderEdit`
 *   makes the cell editable when the row is in edit mode.
 *
 * @property header - Column header label. Defaults to the field name rendered
 *   with CSS `text-transform: capitalize`. Supply an explicit value whenever
 *   the raw field name is unsuitable (e.g. `"White"` for `player_white`).
 *
 * @property isId   - Mark exactly one column `true` to designate the entity
 *   identifier. Its value is used as the React key and as the path parameter
 *   in edit/delete mutations.
 *
 * @property isEditable - Should the column be editable. If yes, an edit button will be
 *   rendered beside the column header allow the whole column to be toggled to edit
 *   mode.
 *
 * @property hidden - When `true`, the column is excluded from the rendered
 *   table entirely (no header, no cell). Use this for surrogate ID fields that
 *   are needed for mutations but have no display value (e.g. a numeric `id`
 *   when the table shows `board`, `player_white`, etc.).
 *
 * @property width  - Optional fixed pixel width. When any column has a width,
 *   the table switches to `table-layout: fixed` and a `<colgroup>` is emitted.
 */
export type Column<T> = {
  [K in keyof T]: {
    field: K;
    cell?: CellConfig<T, K>;
    header?: string;
    isId?: boolean;
    isEditable?: boolean;
    hidden?: boolean;
    width?: string | number;
  };
}[keyof T];

export type TableQueryResult<T> = {
  rows: T[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: components["schemas"]["HTTPValidationError"] | null;
  createMutation: AnyMutation;
  editMutation: AnyMutation;
  deleteMutation: AnyMutation;
};
