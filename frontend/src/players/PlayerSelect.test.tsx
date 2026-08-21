import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils";
import PlayerSelect from "./PlayerSelect";
import * as apiModule from "@client/api";

vi.mock("@client/api", async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  $api: { useQuery: vi.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseQuery = (apiModule.$api as any).useQuery as ReturnType<
  typeof vi.fn
>;

const ALICE = { id: 1, name: "Alice", is_active: true, external_ids: [] };
const DELETED_BOB = { id: 2, name: "Bob", is_active: false, external_ids: [] };

beforeEach(() => {
  // The endpoint only returns active players.
  mockUseQuery.mockReturnValue({
    data: [ALICE],
    error: null,
    isPending: false,
    isError: false,
  });
});

describe("PlayerSelect", () => {
  it("keeps a deleted player that is already set, and marks them", async () => {
    render(<PlayerSelect player={DELETED_BOB} setPlayer={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("Bob (deleted)");

    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getAllByText("Bob (deleted)").length).toBeGreaterThan(0);
  });

  it("can replace the deleted player with an active one", async () => {
    const setPlayer = vi.fn();
    render(<PlayerSelect player={DELETED_BOB} setPlayer={setPlayer} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Alice" }));
    expect(setPlayer).toHaveBeenCalledWith(ALICE);
  });
});
