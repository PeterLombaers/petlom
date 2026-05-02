import React from "react";
import { UseMutationResult } from "@tanstack/react-query";

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
