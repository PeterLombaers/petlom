import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditableTable from "@/table/EditableTable";
import { render, makeMockMutation } from "@/test-utils";
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

const editableColumns: Column<TestEntity>[] = [
  {
    field: "id",
    isId: true,
    hidden: true,
    cell: {
      renderValue: ({ value }: { value: number }) => (
        <span data-testid={`id-${value}`}>{value}</span>
      ),
    },
  },
  {
    field: "name",
    header: "Name",
    isEditable: true,
    cell: {
      renderValue: ({ value }: { value: string }) => (
        <span data-testid={`name-${value}`}>{value}</span>
      ),
      renderEdit: ({
        editValue,
        error,
        onChange,
      }: {
        editValue: string;
        error: string;
        onChange: (v: string) => void;
      }) => (
        <>
          <input
            aria-label="name-edit"
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
          />
          {error && <span data-testid="name-error">{error}</span>}
        </>
      ),
    },
  },
];

const columnEditConfig = {
  validateData: () => ({}),
  sanitizeData: (d: TestEntity) => d,
  getRequestBody: (d: TestEntity) => d,
};

function renderColumnTable(
  overrides: Partial<
    React.ComponentProps<typeof EditableTable<TestEntity>>
  > = {},
) {
  return render(
    <EditableTable<TestEntity>
      queryResult={baseQueryResult}
      entityType="item"
      columns={editableColumns}
      editConfig={columnEditConfig}
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

    it("shows create button when createConfig is provided", () => {
      renderTable({
        createConfig: {
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

  describe("column edit mode", () => {
    it("shows an Edit button in the header of an isEditable column when editConfig is provided", () => {
      renderColumnTable();
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      expect(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      ).toBeInTheDocument();
    });

    it("does not show an Edit button in non-isEditable column headers", () => {
      renderTable({ editConfig: columnEditConfig });
      screen.getAllByRole("columnheader").forEach((header) => {
        expect(
          within(header).queryByRole("button", { name: "Edit" }),
        ).not.toBeInTheDocument();
      });
    });

    it("clicking column Edit puts all rows' cells in that column into edit mode", async () => {
      const user = userEvent.setup();
      renderColumnTable();
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );
      expect(
        screen.getAllByRole("textbox", { name: "name-edit" }),
      ).toHaveLength(testRows.length);
    });

    it("entering column edit hides row-level Edit buttons", async () => {
      const user = userEvent.setup();
      renderColumnTable();
      // Before: 1 column Edit + 2 row Edit buttons = 3 total
      expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );
      expect(screen.queryAllByRole("button", { name: "Edit" })).toHaveLength(0);
    });

    it("Save and Cancel appear in column header when in column edit mode", async () => {
      const user = userEvent.setup();
      renderColumnTable();
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );
      expect(
        within(nameHeader).getByRole("button", { name: "Save" }),
      ).toBeInTheDocument();
      expect(
        within(nameHeader).getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
      expect(
        within(nameHeader).queryByRole("button", { name: "Edit" }),
      ).not.toBeInTheDocument();
    });

    it("Cancel exits column edit mode and restores display values", async () => {
      const user = userEvent.setup();
      renderColumnTable();
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );
      await user.click(
        within(nameHeader).getByRole("button", { name: "Cancel" }),
      );
      expect(
        screen.queryByRole("textbox", { name: "name-edit" }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("name-Alice")).toBeInTheDocument();
      expect(screen.getByTestId("name-Bob")).toBeInTheDocument();
    });

    it("Save calls mutateAsync only for rows where the value changed", async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({});
      renderColumnTable({
        queryResult: {
          ...baseQueryResult,
          editMutation: makeMockMutation({ mutateAsync }),
        },
      });
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );

      const inputs = screen.getAllByRole("textbox", { name: "name-edit" });
      await user.clear(inputs[0]);
      await user.type(inputs[0], "Charlie");

      await user.click(
        within(nameHeader).getByRole("button", { name: "Save" }),
      );

      expect(mutateAsync).toHaveBeenCalledTimes(1);
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ name: "Charlie" }),
          params: { path: { id: 1 } },
        }),
      );
    });

    it("Save shows per-row validation errors and does not call mutateAsync", async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({});
      renderColumnTable({
        queryResult: {
          ...baseQueryResult,
          editMutation: makeMockMutation({ mutateAsync }),
        },
        editConfig: {
          validateData: (d: TestEntity) =>
            d.name === "" ? { name: "Name is required" } : {},
          sanitizeData: (d: TestEntity) => d,
          getRequestBody: (d: TestEntity) => d,
        },
      });
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );

      const inputs = screen.getAllByRole("textbox", { name: "name-edit" });
      await user.clear(inputs[0]);

      await user.click(
        within(nameHeader).getByRole("button", { name: "Save" }),
      );

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(screen.getAllByTestId("name-error")).toHaveLength(1);
    });

    it("a partially failed Save stays in column edit mode and marks only the failed row", async () => {
      const user = userEvent.setup();
      // Alice (id 1) fails, Bob (id 2) succeeds.
      const mutateAsync = vi.fn(({ params }) =>
        params.path.id === 1
          ? Promise.reject({
              detail: [
                { loc: ["body", "name"], msg: "already taken", type: "value" },
              ],
            })
          : Promise.resolve({}),
      );
      renderColumnTable({
        queryResult: {
          ...baseQueryResult,
          editMutation: makeMockMutation({ mutateAsync }),
        },
      });
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );

      const inputs = screen.getAllByRole("textbox", { name: "name-edit" });
      await user.clear(inputs[0]);
      await user.type(inputs[0], "Charlie");
      await user.clear(inputs[1]);
      await user.type(inputs[1], "Dave");

      await user.click(
        within(nameHeader).getByRole("button", { name: "Save" }),
      );

      expect(mutateAsync).toHaveBeenCalledTimes(2);
      // Still in column edit mode, with the typed values preserved.
      expect(
        within(nameHeader).getByRole("button", { name: "Save" }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("textbox", { name: "name-edit" }),
      ).toHaveLength(2);
      // Exactly one row is flagged, and it carries the backend's message.
      const errors = screen.getAllByTestId("name-error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toHaveTextContent("already taken");
    });

    it("falls back to a generic message when a rejection carries no detail", async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
      renderColumnTable({
        queryResult: {
          ...baseQueryResult,
          editMutation: makeMockMutation({ mutateAsync }),
        },
      });
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );

      const inputs = screen.getAllByRole("textbox", { name: "name-edit" });
      await user.clear(inputs[0]);
      await user.type(inputs[0], "Charlie");

      await user.click(
        within(nameHeader).getByRole("button", { name: "Save" }),
      );

      expect(screen.getByTestId("name-error")).toHaveTextContent(
        "Something went wrong.",
      );
    });

    it("a fully successful Save exits column edit mode", async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({});
      renderColumnTable({
        queryResult: {
          ...baseQueryResult,
          editMutation: makeMockMutation({ mutateAsync }),
        },
      });
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );

      const inputs = screen.getAllByRole("textbox", { name: "name-edit" });
      await user.clear(inputs[0]);
      await user.type(inputs[0], "Charlie");

      await user.click(
        within(nameHeader).getByRole("button", { name: "Save" }),
      );

      expect(
        screen.queryByRole("textbox", { name: "name-edit" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("name-error")).not.toBeInTheDocument();
    });
  });

  describe("readOnly", () => {
    const fullConfigs = {
      editConfig: {
        validateData: () => ({}),
        sanitizeData: (d: TestEntity) => d,
        getRequestBody: (d: TestEntity) => d,
      },
      deleteConfig: { getEntityName: (d: TestEntity) => d.name },
      createConfig: {
        getInitialFormData: () => ({}),
        validateForm: () => ({}),
        sanitizeForm: (d: object) => d,
        getRequestBody: (d: object) => d,
        renderContent: () => <div />,
      },
      rowActions: [{ icon: <span />, label: "Merge", onClick: () => {} }],
    };

    it("renders every control for a moderator when it is not set", () => {
      renderTable(fullConfigs);
      expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: "Merge" })).toHaveLength(2);
      expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
    });

    it("hides every control from a moderator when it is set", () => {
      renderTable({ ...fullConfigs, readOnly: true });
      expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Merge" })).toBeNull();
      expect(screen.queryByRole("button", { name: /add/i })).toBeNull();
      expect(
        screen.queryByRole("columnheader", { name: "Actions" }),
      ).toBeNull();
    });

    it("still renders the data", () => {
      renderTable({ ...fullConfigs, readOnly: true });
      expect(screen.getByTestId("name-Alice")).toBeInTheDocument();
      expect(screen.getByTestId("name-Bob")).toBeInTheDocument();
    });
  });

  describe("isRowEditable", () => {
    const onlyAliceEditable = (row: TestEntity) => row.name === "Alice";
    const editConfig = {
      validateData: () => ({}),
      sanitizeData: (d: TestEntity) => d,
      getRequestBody: (d: TestEntity) => d,
    };

    it("gives an Edit button only to the rows it allows", () => {
      renderTable({ editConfig, isRowEditable: onlyAliceEditable });
      expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    });

    it("keeps Delete on a frozen row", () => {
      renderTable({
        editConfig,
        deleteConfig: { getEntityName: (d: TestEntity) => d.name },
        isRowEditable: onlyAliceEditable,
      });
      expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
    });

    it("leaves frozen rows out of column edit", async () => {
      const user = userEvent.setup();
      renderColumnTable({ isRowEditable: onlyAliceEditable });
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );
      // Only Alice turns into an input; Bob keeps showing his value.
      expect(
        screen.getAllByRole("textbox", { name: "name-edit" }),
      ).toHaveLength(1);
      expect(screen.getByTestId("name-Bob")).toBeInTheDocument();
    });

    it("never saves a frozen row on column save", async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({});
      renderColumnTable({
        isRowEditable: onlyAliceEditable,
        queryResult: {
          ...baseQueryResult,
          editMutation: makeMockMutation({ mutateAsync }),
        },
      });
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
      await user.click(
        within(nameHeader).getByRole("button", { name: "Edit" }),
      );
      const input = screen.getByRole("textbox", { name: "name-edit" });
      await user.clear(input);
      await user.type(input, "Charlie");
      await user.click(
        within(nameHeader).getByRole("button", { name: "Save" }),
      );

      expect(mutateAsync).toHaveBeenCalledTimes(1);
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ params: { path: { id: 1 } } }),
      );
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
