import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeleteButton from "@components/DeleteButton";
import { makeMockMutation, render } from "./test-utils";

describe("DeleteButton", () => {
  it("renders the delete icon button", () => {
    render(
      <DeleteButton
        entityType="player"
        entityIdField="id"
        entityId={1}
        entityName="Alice"
        mutation={makeMockMutation()}
      />,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("opens the confirmation dialog when delete icon is clicked", async () => {
    const user = userEvent.setup();
    render(
      <DeleteButton
        entityType="player"
        entityIdField="id"
        entityId={1}
        entityName="Alice"
        mutation={makeMockMutation()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(/Do you want to delete the player Alice/),
    ).toBeInTheDocument();
  });

  it("disables the confirm button until the entity name is typed", async () => {
    const user = userEvent.setup();
    render(
      <DeleteButton
        entityType="player"
        entityIdField="id"
        entityId={1}
        entityName="Alice"
        mutation={makeMockMutation()}
        requireTypedConfirmation={true}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const confirmButton = screen.getByRole("button", { name: "Delete Alice" });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Alice");
    expect(confirmButton).toBeEnabled();
  });

  it("calls mutation.mutate with correct path params on confirm", async () => {
    const user = userEvent.setup();
    const mutation = makeMockMutation();
    render(
      <DeleteButton
        entityType="player"
        entityIdField="id"
        entityId={1}
        entityName="Alice"
        mutation={mutation}
        requireTypedConfirmation={true}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Alice");
    await user.click(screen.getByRole("button", { name: "Delete Alice" }));

    expect(mutation.mutate).toHaveBeenCalledWith(
      { params: { path: { id: 1 } } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("calls mutation.mutate without typing when requireTypedConfirmation is false", async () => {
    const user = userEvent.setup();
    const mutation = makeMockMutation();
    render(
      <DeleteButton
        entityType="match"
        entityIdField="id"
        entityId={42}
        entityName="Board 1"
        mutation={mutation}
        requireTypedConfirmation={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const confirmButton = screen.getByRole("button", {
      name: "Delete Board 1",
    });
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(mutation.mutate).toHaveBeenCalledWith(
      { params: { path: { id: 42 } } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("uses entityIdField as the path key instead of guessing from the id type", async () => {
    const user = userEvent.setup();
    const mutation = makeMockMutation();
    render(
      <DeleteButton
        entityType="competition"
        entityIdField="slug"
        entityId="spring-open"
        entityName="Spring Open"
        mutation={mutation}
        requireTypedConfirmation={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      screen.getByRole("button", { name: "Delete Spring Open" }),
    );

    expect(mutation.mutate).toHaveBeenCalledWith(
      { params: { path: { slug: "spring-open" } } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("does not call mutate when the dialog is opened but not confirmed", async () => {
    const user = userEvent.setup();
    const mutation = makeMockMutation();
    render(
      <DeleteButton
        entityType="player"
        entityIdField="id"
        entityId={1}
        entityName="Alice"
        mutation={mutation}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mutation.mutate).not.toHaveBeenCalled();
  });
});
