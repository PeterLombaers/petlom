import { render, RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";
import type { UseMutationResult } from "@tanstack/react-query";

export function makeMockMutation(
  overrides: Partial<UseMutationResult<unknown, unknown, unknown, unknown>> = {},
): UseMutationResult<unknown, unknown, unknown, unknown> {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    isIdle: true,
    data: undefined,
    error: null,
    reset: vi.fn(),
    status: "idle",
    variables: undefined,
    context: undefined,
    submittedAt: 0,
    failureCount: 0,
    failureReason: null,
    ...overrides,
  } as UseMutationResult<unknown, unknown, unknown, unknown>;
}

// For components that render <tr> themselves (e.g. EditableRow)
export function renderInTable(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => (
      <table>
        <tbody>{children}</tbody>
      </table>
    ),
    ...options,
  });
}

// For components that render <td> themselves (e.g. EditableCell)
export function renderInTableRow(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => (
      <table>
        <tbody>
          <tr>{children}</tr>
        </tbody>
      </table>
    ),
    ...options,
  });
}
