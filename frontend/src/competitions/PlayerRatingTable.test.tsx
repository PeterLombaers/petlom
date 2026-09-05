import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, makeMockMutation } from "@/test-utils";
import PlayerRatingTable from "./PlayerRatingTable";
import * as apiModule from "@client/api";

const mockIsModerator = vi.fn(() => true);
vi.mock("@/auth", () => ({
  useAuth: () => ({ isModerator: mockIsModerator() }),
}));
vi.mock("@client/api", async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  $api: { useQuery: vi.fn(), useMutation: vi.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseQuery = (apiModule.$api as any).useQuery as ReturnType<
  typeof vi.fn
>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseMutation = (apiModule.$api as any).useMutation as ReturnType<
  typeof vi.fn
>;

const RATED = {
  id: 1,
  player_id: 11,
  player: { id: 11, name: "Alice", is_active: true },
  rating_type_id: 1,
  initial_rating: 1500,
  current_rating: 1512.4,
  is_manual: false,
  source_external_rating_id: null,
  created_at: "2024-01-01T00:00:00",
  updated_at: "2024-01-01T00:00:00",
};

const UNRATED = {
  ...RATED,
  id: 2,
  player_id: 22,
  player: { id: 22, name: "Bob", is_active: true },
  initial_rating: null,
  current_rating: null,
};

function renderTable(rows = [RATED, UNRATED], readOnly = false) {
  const patchMutation = makeMockMutation();
  mockUseMutation.mockReturnValue(patchMutation);
  mockUseQuery.mockReturnValue({
    data: rows,
    isPending: false,
    isError: false,
    error: null,
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PlayerRatingTable competitionName="interne" readOnly={readOnly} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return patchMutation;
}

/** Opens row edit for `name` and returns the row. */
async function startRowEdit(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
) {
  const row = screen.getByRole("row", { name });
  await user.click(within(row).getByRole("button", { name: "Edit" }));
  return row;
}

describe("PlayerRatingTable", () => {
  beforeEach(() => {
    mockIsModerator.mockReturnValue(true);
  });

  it("badges a player whose rating is unknown", () => {
    renderTable();
    const row = screen.getByRole("row", { name: /Bob/ });
    // Once for the initial rating and once for the derived one.
    expect(within(row).getAllByText("No rating")).toHaveLength(2);
    expect(screen.getByRole("row", { name: /Alice/ })).toHaveTextContent(
      "1512",
    );
  });

  it("patches the initial rating of the row's player", async () => {
    const user = userEvent.setup();
    const patchMutation = renderTable();

    const row = await startRowEdit(user, /Bob/);
    await user.type(
      within(row).getByRole("textbox", { name: "Initial rating" }),
      "1400",
    );
    await user.click(within(row).getByRole("button", { name: "Save" }));

    expect(patchMutation.mutate).toHaveBeenCalledWith(
      {
        body: { initial_rating: 1400 },
        // The competition is not a column, so the hook supplies it.
        params: { path: { player_id: 22, name: "interne" } },
      },
      expect.anything(),
    );
  });

  it("records an emptied rating as unknown rather than as zero", async () => {
    const user = userEvent.setup();
    const patchMutation = renderTable();

    const row = await startRowEdit(user, /Alice/);
    await user.clear(
      within(row).getByRole("textbox", { name: "Initial rating" }),
    );
    await user.click(within(row).getByRole("button", { name: "Save" }));

    expect(patchMutation.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ body: { initial_rating: null } }),
      expect.anything(),
    );
  });

  it("offers no editing for a finished competition", () => {
    renderTable([RATED, UNRATED], true);
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });
});
