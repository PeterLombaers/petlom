import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, makeMockMutation } from "@/test-utils";
import MergePlayerModal from "./MergePlayerModal";
import * as playersModule from "./usePlayers";
import * as apiModule from "@client/api";

vi.mock("./usePlayers", () => ({ usePlayers: vi.fn() }));
vi.mock("@client/api", async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  $api: { useQuery: vi.fn() },
}));

const mockUsePlayers = vi.mocked(playersModule.usePlayers);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseQuery = (apiModule.$api as any).useQuery as ReturnType<
  typeof vi.fn
>;

const KEEPER = { id: 1, name: "Jan Colijn", is_active: true };
const DUPLICATE = { id: 2, name: "Jan Collijn", is_active: true };

/** Mocks `usePlayers`, returning the merge mutation's `mutate` spy. */
function setupMerge(overrides = {}) {
  const mutate = vi.fn();
  mockUsePlayers.mockReturnValue({
    mergeMutation: makeMockMutation({ mutate, ...overrides }),
    // The modal only reads the merge mutation off the hook.
  } as unknown as ReturnType<typeof playersModule.usePlayers>);
  return mutate;
}

beforeEach(() => {
  mockUseQuery.mockReturnValue({
    data: [KEEPER, DUPLICATE],
    error: null,
    isPending: false,
    isError: false,
  });
});

async function pickDuplicate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Jan Collijn" }));
}

describe("MergePlayerModal", () => {
  it("merges the picked duplicate into the player", async () => {
    const user = userEvent.setup();
    const mutate = setupMerge();
    render(<MergePlayerModal player={KEEPER} onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
    await pickDuplicate(user);
    await user.click(screen.getByRole("button", { name: "Merge" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        params: { path: { id: 1 } },
        body: { other_id: 2, name: "Jan Colijn" },
      },
      expect.anything(),
    );
  });

  it("keeps the other spelling when that name is picked", async () => {
    const user = userEvent.setup();
    const mutate = setupMerge();
    render(<MergePlayerModal player={KEEPER} onClose={vi.fn()} />);

    await pickDuplicate(user);
    await user.click(screen.getByRole("radio", { name: "Jan Collijn" }));
    await user.click(screen.getByRole("button", { name: "Merge" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { other_id: 2, name: "Jan Collijn" },
      }),
      expect.anything(),
    );
  });

  it("shows the conflict the backend refused the merge with", () => {
    setupMerge({
      isError: true,
      error: { detail: "they played each other in interne round 3 board 1." },
    });
    render(<MergePlayerModal player={KEEPER} onClose={vi.fn()} />);

    expect(
      screen.getByText(/they played each other in interne round 3 board 1./),
    ).toBeInTheDocument();
  });
});
