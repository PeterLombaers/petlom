import type { MantineBreakpoint } from "@mantine/core";

/**
 * Mantine's responsive-visibility class: hides the element below `breakpoint`,
 * the same effect as the `visibleFrom` prop on Mantine components. Needed for
 * bare elements that take no Mantine props, such as `<col>` and table cells.
 * Returns undefined when no breakpoint is given, so the element stays visible.
 */
export function visibleFromClass(
  breakpoint: MantineBreakpoint | undefined,
): string | undefined {
  return breakpoint ? `mantine-visible-from-${breakpoint}` : undefined;
}
