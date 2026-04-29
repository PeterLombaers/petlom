import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditButton } from "@components/EditButton";
import { render } from "./test-utils";

describe("EditButton", () => {
  describe("view mode (isEditing=false)", () => {
    it("renders Edit button and no Save/Cancel", () => {
      render(
        <EditButton
          isEditing={false}
          isPending={false}
          onEdit={vi.fn()}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Save" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
    });

    it("calls onEdit when Edit button is clicked", async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      render(
        <EditButton
          isEditing={false}
          isPending={false}
          onEdit={onEdit}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Edit" }));
      expect(onEdit).toHaveBeenCalledOnce();
    });

    it("disables Edit button when isPending", () => {
      render(
        <EditButton
          isEditing={false}
          isPending={true}
          onEdit={vi.fn()}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    });
  });

  describe("edit mode (isEditing=true)", () => {
    it("renders Save and Cancel buttons and no Edit", () => {
      render(
        <EditButton
          isEditing={true}
          isPending={false}
          onEdit={vi.fn()}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Edit" }),
      ).not.toBeInTheDocument();
    });

    it("calls onSave when Save button is clicked", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(
        <EditButton
          isEditing={true}
          isPending={false}
          onEdit={vi.fn()}
          onSave={onSave}
          onCancel={vi.fn()}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(onSave).toHaveBeenCalledOnce();
    });

    it("calls onCancel when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(
        <EditButton
          isEditing={true}
          isPending={false}
          onEdit={vi.fn()}
          onSave={vi.fn()}
          onCancel={onCancel}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("disables Save and Cancel buttons when isPending", () => {
      render(
        <EditButton
          isEditing={true}
          isPending={true}
          onEdit={vi.fn()}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    });
  });
});
