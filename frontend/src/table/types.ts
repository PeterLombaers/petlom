import React from "react";
import { UseMutationResult } from "@tanstack/react-query";
import type { MantineBreakpoint } from "@mantine/core";
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

/**
 * A domain action the table hosts but does not implement, shown as an icon in
 * the Actions column beside Edit and Delete (moderators only).
 *
 * The engine owns the chrome — icon size, aria-label, disabled-while-pending
 * and the responsive rules — so a domain action looks and behaves like the
 * built-in ones. The domain owns the behavior: `onClick` receives the row, and
 * whatever dialog the action needs is mounted by the caller, not by the row.
 * Use this for anything the engine cannot describe with primitives, such as
 * merging two players (it needs a player picker, so no config of primitives
 * would do).
 *
 * @property icon - Rendered inside the ActionIcon. Give it `size={18}`, like
 *   the built-in buttons.
 *
 * @property label - Accessible name of the button, already translated.
 *
 * @property onClick - Called with the row the button belongs to.
 *
 * @property isPending - Disables the button while the action is in flight.
 *
 * @property hideBelow - Applies the same rule the Delete button follows: at or
 *   above the breakpoint the action shows on the resting row, and below it the
 *   action shows only once the row is expanded into edit mode, where there is
 *   room for it.
 */
export interface RowAction<T = unknown> {
  icon: React.ReactNode;
  label: string;
  onClick: (row: T) => void;
  isPending?: boolean;
  hideBelow?: MantineBreakpoint;
}

export interface EditConfig<T = unknown> {
  editMutation: AnyMutation;
  validateData: (editData: T) => Partial<Record<keyof T, string>>;
  sanitizeData: (editData: T) => T;
  getRequestBody: (editData: T) => unknown;
}

/**
 * Props an editable cell's `renderEdit` receives for a value of type `V`.
 *
 * `row` is the whole row being edited, for a control that needs more of it than
 * the value it edits (e.g. a player's name to search a rating source with).
 * Cells that do not care can declare `EditProps<V>` and ignore it.
 */
export type EditProps<V, T = unknown> = {
  editValue: V;
  error: string;
  onChange: (newValue: V) => void;
  row: T;
};

export type CellConfig<T, K extends keyof T> = {
  renderValue: (props: { value: T[K] }) => React.ReactNode;
  renderEdit?: (props: EditProps<T[K], T>) => React.ReactNode;
};

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
 *
 * @property editWidth - Optional column width used while this column is in
 *   column-edit mode (the header edit button); may be larger or smaller than
 *   `width`. Useful when the edit control (e.g. a result toggle) needs a
 *   different amount of room than the displayed value. Falls back to `width`
 *   when unset. Make `width` responsive (e.g. via `useMediaQuery`) if the base
 *   width should differ by screen size.
 *
 * @property hideBelow - When set, the column is hidden on viewports narrower
 *   than the given Mantine breakpoint (e.g. `"sm"` hides it below 768px).
 *
 * @property href - When set, the displayed value is wrapped in an `Anchor`
 *   pointing at the returned target. It receives the whole row, so the link may
 *   use a different field than the one displayed (e.g. a name cell linking to
 *   `/players/{id}`). Return `null` for a row that has nothing to link to (e.g.
 *   a player without a FIDE id) — its value then renders unlinked. Edit mode is
 *   unaffected: the cell still renders its plain edit control.
 *
 * @property external - Marks the `href` as leading outside the app. External
 *   links render as a plain anchor opening in a new tab; internal ones (the
 *   default) navigate through the router without a full page reload.
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
    editWidth?: string | number;
    hideBelow?: MantineBreakpoint;
    href?: (row: T) => string | null;
    external?: boolean;
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
