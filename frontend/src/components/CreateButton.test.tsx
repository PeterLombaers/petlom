import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextInput } from "@mantine/core";
import { CreateButton, CreateDialogConfig } from "@components/CreateButton";
import { makeMockMutation, render } from "./test-utils";

const dialogConfig: CreateDialogConfig<{ name: string }> = {
  getInitialFormData: () => ({ name: "" }),
  validateForm: () => ({}),
  sanitizeForm: (data) => data,
  getRequestBody: (data) => data,
  renderContent: ({ formData, errors, onChange }) => (
    <TextInput
      label="Name"
      value={formData.name}
      error={errors.name || undefined}
      onChange={(e) => onChange("name", e.target.value)}
    />
  ),
};

describe("CreateButton server field errors", () => {
  it("shows a server field error inline on the relevant field", async () => {
    const user = userEvent.setup();
    const serverError = {
      detail: [
        {
          loc: ["body", "name"],
          msg: "A competition with this name already exists.",
          type: "value_error.duplicate",
        },
      ],
    };
    const mutation = makeMockMutation({
      mutate: vi
        .fn()
        .mockImplementation(
          (_: unknown, cbs: { onError?: (e: unknown) => void }) =>
            cbs?.onError?.(serverError),
        ),
    });
    render(
      <CreateButton
        entityType="player"
        mutation={mutation}
        dialogConfig={dialogConfig}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add player" }));
    await user.keyboard("{Enter}");

    expect(mutation.mutate).toHaveBeenCalledOnce();
    expect(
      screen.getByText("A competition with this name already exists."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("CreateButton keyboard shortcuts", () => {
  it("submits and closes the dialog on Enter", async () => {
    const user = userEvent.setup();
    const mutation = makeMockMutation({
      mutate: vi
        .fn()
        .mockImplementation((_: unknown, cbs: { onSuccess?: () => void }) =>
          cbs?.onSuccess?.(),
        ),
    });
    render(
      <CreateButton
        entityType="player"
        mutation={mutation}
        dialogConfig={dialogConfig}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add player" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(mutation.mutate).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("submits and keeps the dialog open on Shift+Enter", async () => {
    const user = userEvent.setup();
    const mutation = makeMockMutation({
      mutate: vi
        .fn()
        .mockImplementation((_: unknown, cbs: { onSuccess?: () => void }) =>
          cbs?.onSuccess?.(),
        ),
    });
    render(
      <CreateButton
        entityType="player"
        mutation={mutation}
        dialogConfig={dialogConfig}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add player" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(mutation.mutate).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
