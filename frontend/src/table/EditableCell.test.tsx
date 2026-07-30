import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditableCell from "@/table/EditableCell";
import { renderInTableRow } from "@/test-utils";

const renderValue = ({ value }: { value: string }) => (
  <span data-testid="display-value">{value}</span>
);

const renderEdit = ({
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
      aria-label="edit-input"
      value={editValue}
      onChange={(e) => onChange(e.target.value)}
    />
    {error && <span data-testid="error-msg">{error}</span>}
  </>
);

describe("EditableCell", () => {
  it("renders display value when not editing", () => {
    renderInTableRow(
      <EditableCell
        isEditing={false}
        value="Alice"
        editValue="Alice"
        setEditValue={vi.fn()}
        renderValue={renderValue}
        renderEdit={renderEdit}
        error=""
      />,
    );
    expect(screen.getByTestId("display-value")).toHaveTextContent("Alice");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders edit input when editing", () => {
    renderInTableRow(
      <EditableCell
        isEditing={true}
        value="Alice"
        editValue="Bob"
        setEditValue={vi.fn()}
        renderValue={renderValue}
        renderEdit={renderEdit}
        error=""
      />,
    );
    expect(screen.getByRole("textbox", { name: "edit-input" })).toHaveValue(
      "Bob",
    );
    expect(screen.queryByTestId("display-value")).not.toBeInTheDocument();
  });

  it("passes error string to renderEdit", () => {
    renderInTableRow(
      <EditableCell
        isEditing={true}
        value=""
        editValue=""
        setEditValue={vi.fn()}
        renderValue={renderValue}
        renderEdit={renderEdit}
        error="Name is required"
      />,
    );
    expect(screen.getByTestId("error-msg")).toHaveTextContent(
      "Name is required",
    );
  });

  it("calls setEditValue with new value when onChange fires", async () => {
    const user = userEvent.setup();
    const setEditValue = vi.fn();
    renderInTableRow(
      <EditableCell
        isEditing={true}
        value=""
        editValue=""
        setEditValue={setEditValue}
        renderValue={renderValue}
        renderEdit={renderEdit}
        error=""
      />,
    );
    await user.type(screen.getByRole("textbox"), "B");
    expect(setEditValue).toHaveBeenCalledWith("B");
  });
});
