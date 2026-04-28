import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UseMutationResult } from "@tanstack/react-query";
import { TextField } from "@mui/material";
import { CreateButton, CreateDialogConfig } from "@components/CreateButton";

function makeMockMutation(
  overrides: Partial<UseMutationResult<unknown, unknown, unknown, unknown>> = {},
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

const dialogConfig: CreateDialogConfig<{ name: string }> = {
  getInitialFormData: () => ({ name: "" }),
  validateForm: () => ({}),
  sanitizeForm: (data) => data,
  getRequestBody: (data) => data,
  renderContent: ({ formData, onChange }) => (
    <TextField
      label="Name"
      value={formData.name}
      onChange={(e) => onChange("name", e.target.value)}
    />
  ),
};

describe("CreateButton keyboard shortcuts", () => {
  it("submits and closes the dialog on Enter", async () => {
    const user = userEvent.setup();
    const mutation = makeMockMutation({
      mutate: vi.fn((_, callbacks: any) => callbacks?.onSuccess?.()),
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
      mutate: vi.fn((_, callbacks: any) => callbacks?.onSuccess?.()),
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
