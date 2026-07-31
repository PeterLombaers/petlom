import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils";
import SeedRatingsModal, { PlayerNeedingRating } from "./SeedRatingsModal";
import * as apiModule from "@client/api";

vi.mock("@client/api", async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  $api: { useQuery: vi.fn(), useMutation: vi.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseQuery = (apiModule.$api as any).useQuery as ReturnType<
  typeof vi.fn
>;

function makePlayer(
  id: number,
  name: string,
  fideRating: number | null,
): PlayerNeedingRating {
  return {
    id,
    name,
    is_active: true,
    created_at: "2024-01-01T00:00:00",
    updated_at: "2024-01-01T00:00:00",
    external_ids:
      fideRating == null
        ? []
        : [
            {
              id: id * 10,
              source: "fide" as const,
              external_id: String(1000 + id),
              created_at: "2024-01-01T00:00:00",
              updated_at: "2024-01-01T00:00:00",
              rating: {
                id: id * 100,
                player_external_id_id: id * 10,
                source: "fide" as const,
                rating: fideRating,
                list_date: "2026-05",
                imported_at: "2026-05-02T00:00:00",
              },
            },
          ],
  };
}

const ALICE = makePlayer(1, "Alice", 2100);
const BOB = makePlayer(2, "Bob", 1800);

/** Answers each of the modal's queries by path. */
function setupMocks({
  competitionRatings = [] as { player_id: number; current_rating: number }[],
} = {}) {
  mockUseQuery.mockImplementation((_method: string, path: string) => {
    if (path === "/competitions/")
      return { data: [{ name: "OldComp", type: "simkro" }] };
    if (path === "/competitions/{name}/player-ratings")
      return { data: competitionRatings };
    return { data: [] };
  });
}

function renderModal(players = [ALICE, BOB], options = {}) {
  setupMocks(options);
  const onConfirm = vi.fn();
  render(
    <SeedRatingsModal
      players={players}
      competitionName="NewComp"
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm };
}

const ratingInput = (playerName: string) =>
  screen.getByRole("textbox", { name: `Initial rating for ${playerName}` });

describe("SeedRatingsModal", () => {
  it("shows each player's FIDE rating and keeps Confirm disabled until filled", () => {
    renderModal();

    expect(screen.getByText("2100")).toBeInTheDocument();
    expect(screen.getByText("1800")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("seeds every row from FIDE and confirms the filled ratings", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderModal();

    await user.click(screen.getByRole("button", { name: "Seed all" }));

    expect(ratingInput("Alice")).toHaveValue("2100");
    expect(ratingInput("Bob")).toHaveValue("1800");

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith({ 1: 2100, 2: 1800 });
  });

  it("lets a manual override win over the bulk seed", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderModal();

    await user.click(screen.getByRole("button", { name: "Seed all" }));
    await user.clear(ratingInput("Bob"));
    await user.type(ratingInput("Bob"), "1500");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith({ 1: 2100, 2: 1500 });
  });

  it("fills a player from the selected competition when that source is picked", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderModal([ALICE, BOB], {
      competitionRatings: [{ player_id: 2, current_rating: 1650.4 }],
    });

    await user.click(screen.getByRole("button", { name: "Seed all" }));
    await user.click(
      screen.getByRole("combobox", { name: "Rating source for Bob" }),
    );
    await user.click(screen.getByRole("option", { name: "Competition" }));

    expect(ratingInput("Bob")).toHaveValue("1650");

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith({ 1: 2100, 2: 1650 });
  });

  it("disables a source with no data for that player", async () => {
    const user = userEvent.setup();
    renderModal([makePlayer(3, "Carol", null)]);

    await user.click(
      screen.getByRole("combobox", { name: "Rating source for Carol" }),
    );

    expect(screen.getByRole("option", { name: "FIDE" })).toHaveAttribute(
      "data-combobox-disabled",
    );
  });
});
