import { render, RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";

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
