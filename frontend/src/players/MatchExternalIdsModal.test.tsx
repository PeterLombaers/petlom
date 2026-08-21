import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, makeMockMutation } from "@/test-utils";
import MatchExternalIdsModal from "./MatchExternalIdsModal";
import * as matchModule from "./useMatchExternalIds";

vi.mock("./useMatchExternalIds", () => ({ useMatchExternalIds: vi.fn() }));

const mockUseMatchExternalIds = vi.mocked(matchModule.useMatchExternalIds);

const RESULT = {
  source: "fide" as const,
  searched: 3,
  matched: [
    {
      player_id: 1,
      player_name: "Alice",
      external_id: "1503014",
      external_name: "Carlsen, Magnus",
    },
  ],
  skipped: [
    { player_id: 2, player_name: "Bob", reason: "ambiguous" as const },
    { player_id: 3, player_name: "Carol", reason: "not_found" as const },
  ],
};

/** A mutation whose `mutate` hands `result` to the caller's `onSuccess`. */
function setupMutation(result: typeof RESULT | null = RESULT, overrides = {}) {
  const mutate = vi.fn();
  mutate.mockImplementation(
    (_variables, options?: { onSuccess?: (data: typeof RESULT) => void }) => {
      if (result) options?.onSuccess?.(result);
    },
  );
  mockUseMatchExternalIds.mockReturnValue(
    // The hook is typed against the endpoint; the mock only fills in what the
    // modal reads.
    makeMockMutation({ mutate, ...overrides }) as ReturnType<
      typeof matchModule.useMatchExternalIds
    >,
  );
  return mutate;
}

function renderModal() {
  const onClose = vi.fn();
  render(<MatchExternalIdsModal onClose={onClose} />);
  return onClose;
}

describe("MatchExternalIdsModal", () => {
  it("searches the source that was picked", async () => {
    const user = userEvent.setup();
    const mutate = setupMutation();
    renderModal();

    await user.click(screen.getByRole("radio", { name: "KNSB" }));
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(mutate).toHaveBeenCalledWith(
      { params: { path: { source: "knsb" } }, body: {} },
      expect.anything(),
    );
  });

  it("reports what was matched and what was not", async () => {
    const user = userEvent.setup();
    setupMutation();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      screen.getByText("Matched 1 of 3 players searched."),
    ).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Alice/ });
    expect(row).toHaveTextContent("Carlsen, Magnus");
    expect(row).toHaveTextContent("1503014");
    expect(
      screen.getByText(/Several players with this name/).parentElement,
    ).toHaveTextContent("Bob");
    expect(screen.getByText(/^Not found/).parentElement).toHaveTextContent(
      "Carol",
    );
  });

  it("says so when every player already has an id", async () => {
    const user = userEvent.setup();
    setupMutation({ source: "fide", searched: 0, matched: [], skipped: [] });
    renderModal();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      screen.getByText("Every player already has an ID at this source."),
    ).toBeInTheDocument();
  });

  it("shows the error of a failed run", () => {
    setupMutation(null, {
      isError: true,
      error: { detail: "The rating database has no data for KNSB" },
    });
    renderModal();

    expect(
      screen.getByText("The rating database has no data for KNSB"),
    ).toBeInTheDocument();
  });

  it("drops a previous result when the source changes", async () => {
    const user = userEvent.setup();
    setupMutation();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("table")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "KNSB" }));
    expect(screen.queryByRole("table")).toBeNull();
  });
});
