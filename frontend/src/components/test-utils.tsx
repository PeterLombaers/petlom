import {
  render as testingLibraryRender,
  RenderOptions,
} from "@testing-library/react";
import { MantineProvider, Table } from "@mantine/core";
import { ReactElement } from "react";
import type { UseMutationResult } from "@tanstack/react-query";

/**
 * Creates a fully-typed mock for a React Query mutation.
 *
 * React Query's `useMutation` returns a fairly large object with many fields. In tests,
 * we usually only care about a few of them (e.g. isPending, mutate). This helper gives
 * us a complete default object so TypeScript is satisfied, while still allowing tests
 * to override only the fields they care about.
 *
 * Example:
 *   const mutation = makeMockMutation({ isPending: true });
 */
export function makeMockMutation(
  overrides: Partial<
    UseMutationResult<unknown, unknown, unknown, unknown>
  > = {},
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

/**
 * Extends `RenderOptions` to allow passing a custom wrapper. See `renderInTable` for
 * example usage.
 */
type CustomRenderOptions = RenderOptions & {
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
};

/**
 * Custom render function used across the test suite.
 *
 * Always wraps the UI in MantineProvider (env="test" disables animations).
 * See https://mantine.dev/guides/vitest/
 *
 * Optionally wraps the UI in an additional custom wrapper (e.g. a table
 * scaffold for components that render <tr> or <td> elements).
 */
export function render(ui: ReactElement, options?: CustomRenderOptions) {
  const { wrapper: CustomWrapper, ...rest } = options || {};
  return testingLibraryRender(ui, {
    wrapper: ({ children }) => (
      <MantineProvider env="test">
        {CustomWrapper ? <CustomWrapper>{children}</CustomWrapper> : children}
      </MantineProvider>
    ),
    ...rest,
  });
}

/**
 * Renders a component inside a Mantine table.
 */

export function renderInTable(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => (
      <Table>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
    ),
    ...options,
  });
}

/**
 * Renders a component inside a Mantine table row.
 */
export function renderInTableRow(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => (
      <Table>
        <Table.Tbody>
          <Table.Tr>{children}</Table.Tr>
        </Table.Tbody>
      </Table>
    ),
    ...options,
  });
}
