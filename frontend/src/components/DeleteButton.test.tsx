import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import type { UseMutationResult } from "@tanstack/react-query";
import DeleteButton from "@components/DeleteButton";

function makeMockMutation(
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

describe("DeleteButton", () => {
  it("renders the delete icon button", () => {
    render(
      <DeleteButton
        entityType="player"
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

  it("does not call mutate when the dialog is opened but not confirmed", async () => {
    const user = userEvent.setup();
    const mutation = makeMockMutation();
    render(
      <DeleteButton
        entityType="player"
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
