import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditableTable from "@components/EditableTable";
import { render, makeMockMutation } from "./test-utils";
import type { Column } from "./types";

vi.mock("@/auth", () => ({ useAuth: () => ({ isModerator: true }) }));

type TestEntity = { id: number; name: string };

const testRows: TestEntity[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

const testColumns: Column<TestEntity>[] = [
  {
    field: "id",
    isId: true,
    cell: {
      renderValue: ({ value }: { value: number }) => (
        <span data-testid={`id-${value}`}>{value}</span>
      ),
    },
  },
  {
    field: "name",
    header: "Name",
    cell: {
      renderValue: ({ value }: { value: string }) => (
        <span data-testid={`name-${value}`}>{value}</span>
      ),
      renderEdit: ({
        editValue,
        onChange,
      }: {
        editValue: string;
        error: string;
        onChange: (v: string) => void;
      }) => (
        <input
          aria-label="name-edit"
          value={editValue}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
  },
];

const baseQueryResult = {
  rows: testRows,
  isPending: false,
  isError: false,
  error: null,
  createMutation: makeMockMutation(),
  editMutation: makeMockMutation(),
  deleteMutation: makeMockMutation(),
};

function renderTable(
  overrides: Partial<
    React.ComponentProps<typeof EditableTable<TestEntity>>
  > = {},
) {
  return render(
    <EditableTable<TestEntity>
      queryResult={baseQueryResult}
      entityType="item"
      columns={testColumns}
      {...overrides}
    />,
  );
}

describe("EditableTable", () => {
  describe("empty state", () => {
    it("renders emptyMessage when rows is empty", () => {
      renderTable({ queryResult: { ...baseQueryResult, rows: [] } });
      expect(screen.getByText("No items yet.")).toBeInTheDocument();
    });

    it("does not render emptyMessage when rows exist", () => {
      renderTable();
      expect(screen.queryByText("No items yet.")).not.toBeInTheDocument();
    });
  });

  describe("row rendering", () => {
    it("renders one row per item", () => {
      renderTable();
      expect(screen.getByTestId("name-Alice")).toBeInTheDocument();
      expect(screen.getByTestId("name-Bob")).toBeInTheDocument();
    });
  });

  describe("column headers", () => {
    it("renders each column header", () => {
      renderTable();
      expect(
        screen.getByRole("columnheader", { name: "id" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Name" }),
      ).toBeInTheDocument();
    });

    it("renders Actions header when editConfig is provided", () => {
      renderTable({
        editConfig: {
          validateData: () => ({}),
          sanitizeData: (d) => d,
          getRequestBody: (d) => d,
        },
      });
      expect(
        screen.getByRole("columnheader", { name: "Actions" }),
      ).toBeInTheDocument();
    });

    it("does not render Actions header when editConfig is absent", () => {
      renderTable();
      expect(
        screen.queryByRole("columnheader", { name: "Actions" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("title bar", () => {
    it("shows title text when title is provided", () => {
      renderTable({ title: "My Table" });
      expect(screen.getByText("My Table")).toBeInTheDocument();
    });

    it("shows create button when createDialogConfig is provided", () => {
      renderTable({
        createDialogConfig: {
          getInitialFormData: () => ({}),
          validateForm: () => ({}),
          sanitizeForm: (d) => d,
          getRequestBody: (d) => d,
          renderContent: () => <div />,
        },
      });
      expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
    });
  });

  describe("one-at-a-time editing", () => {
    it("editing row A then clicking Edit on row B exits row A", async () => {
      const user = userEvent.setup();
      const editConfig = {
        validateData: () => ({}),
        sanitizeData: (d: TestEntity) => d,
        getRequestBody: (d: TestEntity) => d,
      };
      renderTable({ editConfig });

      // Both rows start with an Edit button
      expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);

      // Click Edit on row 1 (Alice) — row 1 now shows Save/Cancel, row 2 still shows Edit
      const [editAlice] = screen.getAllByRole("button", { name: "Edit" });
      await user.click(editAlice);
      expect(
        screen.getByRole("textbox", { name: "name-edit" }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);

      // Only Bob's Edit button is now visible; click it
      await user.click(screen.getByRole("button", { name: "Edit" }));

      // Row 1 exits edit mode, row 2 enters — still exactly one Save and one input
      expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);
      expect(
        screen.getAllByRole("textbox", { name: "name-edit" }),
      ).toHaveLength(1);
    });
  });
});
