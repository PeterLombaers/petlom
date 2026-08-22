import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import EditableRow from "@/table/EditableRow";
import type { Column } from "@/table/types";
import { renderInTable, makeMockMutation } from "@/test-utils";

type TestEntity = { id: number; name: string };

const testData: TestEntity = { id: 1, name: "Alice" };

const testColumns: Column<TestEntity>[] = [
  {
    field: "id",
    isId: true,
    cell: {
      renderValue: ({ value }) => <span data-testid="id-value">{value}</span>,
    },
  },
  {
    field: "name",
    cell: {
      renderValue: ({ value }) => <span data-testid="name-value">{value}</span>,
      renderEdit: ({ editValue, error, onChange }) => (
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

function makeEditConfig(
  editMutation: UseMutationResult<unknown, unknown, unknown, unknown>,
  options: {
    validateData?: (d: TestEntity) => Partial<Record<keyof TestEntity, string>>;
  } = {},
) {
  return {
    editMutation,
    sanitizeData: (d: TestEntity) => ({ ...d, name: d.name.trim() }),
    validateData:
      options.validateData ??
      ((d: TestEntity) => (d.name === "" ? { name: "Name is required" } : {})),
    getRequestBody: (d: TestEntity) => ({ name: d.name }),
  };
}

// Stateful wrapper that manages isEditing the same way a real parent would.
// Use this for tests that exercise the full open → interact → close → reopen flow.
function StatefulEditableRow({
  data = testData,
  editConfig,
}: {
  data?: TestEntity;
  editConfig?: ReturnType<typeof makeEditConfig>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <EditableRow<TestEntity>
      data={data}
      isEditing={isEditing}
      setIsEditing={setIsEditing}
      columns={testColumns}
      entityIdField="id"
      editConfig={editConfig}
    />
  );
}

describe("EditableRow", () => {
  describe("view mode (isEditing=false)", () => {
    it("renders the display value, not an edit input", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
        />,
      );
      expect(screen.getByTestId("name-value")).toHaveTextContent("Alice");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("renders the Edit button and no Save/Cancel", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(makeMockMutation())}
        />,
      );
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Save" }),
      ).not.toBeInTheDocument();
    });

    it("renders no action buttons when editConfig is not provided", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
        />,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("edit mode (isEditing=true)", () => {
    it("renders the edit input pre-filled with the current value", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={true}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(makeMockMutation())}
        />,
      );
      expect(screen.getByRole("textbox", { name: "name-edit" })).toHaveValue(
        "Alice",
      );
    });

    it("renders Save and Cancel buttons", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={true}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(makeMockMutation())}
        />,
      );
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });
  });

  describe("cancel", () => {
    it("calls setIsEditing(false) when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const setIsEditing = vi.fn();
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={true}
          setIsEditing={setIsEditing}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(makeMockMutation())}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(setIsEditing).toHaveBeenCalledWith(false);
    });

    it("resets the edit input to original value on next open after cancel", async () => {
      const user = userEvent.setup();
      renderInTable(
        <StatefulEditableRow editConfig={makeEditConfig(makeMockMutation())} />,
      );

      await user.click(screen.getByRole("button", { name: "Edit" }));

      const input = screen.getByRole("textbox", { name: "name-edit" });
      await user.clear(input);
      await user.type(input, "Bob");
      expect(input).toHaveValue("Bob");

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(screen.getByRole("button", { name: "Edit" }));

      expect(screen.getByRole("textbox", { name: "name-edit" })).toHaveValue(
        "Alice",
      );
    });
  });

  describe("save — validation failure", () => {
    it("does not call mutate when validation fails", async () => {
      const user = userEvent.setup();
      const editMutation = makeMockMutation();
      renderInTable(
        <EditableRow
          data={{ id: 1, name: "" }}
          isEditing={true}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(editMutation)}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(editMutation.mutate).not.toHaveBeenCalled();
    });

    it("shows the validation error message", async () => {
      const user = userEvent.setup();
      renderInTable(
        <EditableRow
          data={{ id: 1, name: "" }}
          isEditing={true}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(makeMockMutation())}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByTestId("name-error")).toHaveTextContent(
        "Name is required",
      );
    });

    it("clears the error for a field when the user types in it", async () => {
      const user = userEvent.setup();
      renderInTable(
        <EditableRow
          data={{ id: 1, name: "" }}
          isEditing={true}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(makeMockMutation())}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByTestId("name-error")).toBeInTheDocument();

      await user.type(screen.getByRole("textbox", { name: "name-edit" }), "B");
      expect(screen.queryByTestId("name-error")).not.toBeInTheDocument();
    });
  });

  describe("save — success", () => {
    it("calls mutate with sanitized body and entity path params", async () => {
      const user = userEvent.setup();
      const editMutation = makeMockMutation();
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={true}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(editMutation)}
        />,
      );

      const input = screen.getByRole("textbox", { name: "name-edit" });
      await user.clear(input);
      await user.type(input, "  Bob  ");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(editMutation.mutate).toHaveBeenCalledWith(
        { body: { name: "Bob" }, params: { path: { id: 1 } } },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("calls setIsEditing(false) in the onSuccess callback", async () => {
      const user = userEvent.setup();
      const setIsEditing = vi.fn();
      const mutate = vi
        .fn()
        .mockImplementation(
          (_vars: unknown, callbacks: { onSuccess: () => void }) => {
            callbacks.onSuccess();
          },
        );
      const editMutation = makeMockMutation({ mutate });
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={true}
          setIsEditing={setIsEditing}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(editMutation)}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(setIsEditing).toHaveBeenCalledWith(false);
    });
  });

  describe("linked columns (href)", () => {
    const linkedColumns: Column<TestEntity>[] = [
      {
        ...testColumns[1],
        href: (row) => `/players/${row.id}`,
      },
    ];

    const renderLinked = (columns: Column<TestEntity>[], isEditing = false) =>
      renderInTable(
        <MemoryRouter>
          <EditableRow
            data={testData}
            isEditing={isEditing}
            setIsEditing={vi.fn()}
            columns={columns}
            entityIdField="id"
            editConfig={makeEditConfig(makeMockMutation())}
          />
        </MemoryRouter>,
      );

    it("wraps the displayed value in a link built from the whole row", () => {
      renderLinked(linkedColumns);
      const link = screen.getByRole("link", { name: "Alice" });
      expect(link).toHaveAttribute("href", "/players/1");
      expect(screen.getByTestId("name-value")).toBeInTheDocument();
    });

    it("renders an external link in a new tab", () => {
      renderLinked([
        {
          ...testColumns[1],
          href: (row) => `https://example.com/${row.id}`,
          external: true,
        },
      ]);
      const link = screen.getByRole("link", { name: "Alice" });
      expect(link).toHaveAttribute("href", "https://example.com/1");
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("renders the value unlinked when href returns null for the row", () => {
      renderLinked([{ ...testColumns[1], href: () => null }]);
      expect(screen.getByTestId("name-value")).toHaveTextContent("Alice");
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("renders a plain input, without a link, in edit mode", () => {
      renderLinked(linkedColumns, true);
      expect(screen.getByRole("textbox", { name: "name-edit" })).toHaveValue(
        "Alice",
      );
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("column edit mode", () => {
    it("renders the column cell in edit mode with columnEditValue when columnEditField is set", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          columnEditField="name"
          columnEditValue="Edited"
          columnEditError=""
          onColumnEditChange={vi.fn()}
        />,
      );
      expect(screen.getByRole("textbox", { name: "name-edit" })).toHaveValue(
        "Edited",
      );
    });

    it("calls onColumnEditChange when the column edit cell value changes", async () => {
      const user = userEvent.setup();
      const onColumnEditChange = vi.fn();
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          columnEditField="name"
          columnEditValue="Alice"
          columnEditError=""
          onColumnEditChange={onColumnEditChange}
        />,
      );
      const input = screen.getByRole("textbox", { name: "name-edit" });
      await user.clear(input);
      await user.type(input, "Z");
      expect(onColumnEditChange).toHaveBeenCalled();
    });

    it("displays columnEditError in the column edit cell", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          columnEditField="name"
          columnEditValue=""
          columnEditError="Name is required"
          onColumnEditChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId("name-error")).toHaveTextContent(
        "Name is required",
      );
    });

    it("hides Edit and Delete buttons when hideRowEditButton is true", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(makeMockMutation())}
          hideRowEditButton={true}
        />,
      );
      expect(
        screen.queryByRole("button", { name: "Edit" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("pending state", () => {
    it("disables the Edit button when mutation isPending", () => {
      const editMutation = makeMockMutation({ isPending: true });
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(editMutation)}
        />,
      );
      expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    });
  });

  describe("row actions", () => {
    const mergeAction = (overrides = {}) => ({
      icon: <span data-testid="merge-icon" />,
      label: "Merge",
      onClick: vi.fn(),
      ...overrides,
    });

    it("calls onClick with the row", async () => {
      const user = userEvent.setup();
      const action = mergeAction();
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          rowActions={[action]}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Merge" }));
      expect(action.onClick).toHaveBeenCalledWith(testData);
    });

    it("renders the actions cell without an editConfig", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          rowActions={[mergeAction()]}
        />,
      );
      expect(screen.getByRole("button", { name: "Merge" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Edit" }),
      ).not.toBeInTheDocument();
    });

    it("disables the button while the action is pending", () => {
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          rowActions={[mergeAction({ isPending: true })]}
        />,
      );
      expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
    });

    it("shows every action on a resting row", () => {
      // Nothing is hidden on narrow screens; the table scrolls instead.
      renderInTable(
        <EditableRow
          data={testData}
          isEditing={false}
          setIsEditing={vi.fn()}
          columns={testColumns}
          entityIdField="id"
          editConfig={makeEditConfig(makeMockMutation())}
          deleteConfig={{
            deleteMutation: makeMockMutation(),
            entityType: "player",
            getEntityName: (d: TestEntity) => d.name,
          }}
          rowActions={[mergeAction()]}
        />,
      );
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Merge" })).toBeInTheDocument();
    });
  });
});
