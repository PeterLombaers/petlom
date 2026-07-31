import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, makeMockMutation } from "@/test-utils";
import PlayerDetail from "./PlayerDetail";
import * as apiModule from "@client/api";

vi.mock("@/auth", () => ({ useAuth: () => ({ isModerator: true }) }));
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

const ratingType = (competitionName: string, createdAt: string) => ({
  id: 1,
  name: "elo",
  algorithm: "elo" as const,
  algorithm_config: null,
  competition_name: competitionName,
  default_initial_rating: 1200,
  created_at: createdAt,
  updated_at: createdAt,
});

const ALICE = {
  id: 1,
  name: "Alice",
  is_active: true,
  created_at: "2024-01-01T00:00:00",
  updated_at: "2024-01-01T00:00:00",
  external_ids: [
    {
      id: 10,
      source: "fide" as const,
      external_id: "1503014",
      created_at: "2024-01-01T00:00:00",
      updated_at: "2024-01-01T00:00:00",
      rating: {
        id: 100,
        player_external_id_id: 10,
        source: "fide" as const,
        rating: 2839,
        list_date: "2026-05",
        imported_at: "2026-05-02T00:00:00",
      },
    },
  ],
  competition_ratings: [
    {
      id: 5,
      initial_rating: 1400,
      current_rating: 1455,
      is_manual: false,
      source_external_rating_id: null,
      rating_type: ratingType("Autumn", "2025-09-01T00:00:00"),
    },
    {
      id: 6,
      initial_rating: 1500,
      current_rating: 1512,
      is_manual: true,
      source_external_rating_id: null,
      rating_type: ratingType("Spring", "2026-03-01T00:00:00"),
    },
  ],
};

function setupMocks(player: unknown = ALICE) {
  const mutations = {
    "patch /players/{id}/": makeMockMutation(),
    "put /players/{id}/external-ids/{source}/": makeMockMutation(),
    "delete /players/{id}/external-ids/{source}/": makeMockMutation(),
    "post /external/{source}/import/": makeMockMutation(),
  };
  mockUseMutation.mockImplementation(
    (method: string, path: string) =>
      mutations[`${method} ${path}` as keyof typeof mutations] ??
      makeMockMutation(),
  );
  mockUseQuery.mockReturnValue({
    data: player,
    isPending: false,
    isError: false,
    error: null,
  });
  return mutations;
}

function renderDetail(player: unknown = ALICE) {
  const mutations = setupMocks(player);
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlayerDetail playerId={1} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return mutations;
}

describe("PlayerDetail", () => {
  it("shows the player's name as the page heading", () => {
    renderDetail();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Alice",
    );
  });

  it("lists the external ids with their rating snapshot", () => {
    renderDetail();
    const link = screen.getByRole("link", { name: "1503014" });
    expect(link).toHaveAttribute(
      "href",
      "https://ratings.fide.com/profile/1503014",
    );
    const row = link.closest("tr") as HTMLElement;
    expect(within(row).getByText("2839")).toBeInTheDocument();
    expect(within(row).getByText("2026-05")).toBeInTheDocument();
  });

  it("lists the competitions, most recent first, linking to each", () => {
    renderDetail();
    const links = screen
      .getAllByRole("link")
      .filter((link) =>
        link.getAttribute("href")?.startsWith("/competitions/"),
      );
    expect(links.map((link) => link.textContent)).toEqual(["Spring", "Autumn"]);
    expect(links[0]).toHaveAttribute("href", "/competitions/Spring");
    const row = links[0].closest("tr") as HTMLElement;
    expect(within(row).getByText("1500")).toBeInTheDocument();
    expect(within(row).getByText("1512")).toBeInTheDocument();
  });

  it("refreshes only this player's FIDE rating", async () => {
    const user = userEvent.setup();
    const mutations = renderDetail();

    await user.click(
      screen.getByRole("button", { name: "Refresh FIDE rating" }),
    );

    expect(
      mutations["post /external/{source}/import/"].mutate,
    ).toHaveBeenCalledWith({
      params: { path: { source: "fide" } },
      body: { player_ids: [1], update_existing: true },
    });
  });

  describe("editing", () => {
    it("patches the name and puts the FIDE id that changed", async () => {
      const user = userEvent.setup();
      const mutations = renderDetail();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      const nameInput = screen.getByRole("textbox", { name: /Name/ });
      await user.clear(nameInput);
      await user.type(nameInput, "Alicia");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(
        mutations["patch /players/{id}/"].mutateAsync,
      ).toHaveBeenCalledWith({
        body: { name: "Alicia" },
        params: { path: { id: 1 } },
      });
      expect(
        mutations["put /players/{id}/external-ids/{source}/"].mutateAsync,
      ).not.toHaveBeenCalled();
    });

    it("deletes the external id when the FIDE id is cleared", async () => {
      const user = userEvent.setup();
      const mutations = renderDetail();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.clear(screen.getByRole("textbox", { name: "FIDE ID" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(
        mutations["delete /players/{id}/external-ids/{source}/"].mutateAsync,
      ).toHaveBeenCalledWith({
        params: { path: { id: 1, source: "fide" } },
      });
      expect(
        mutations["patch /players/{id}/"].mutateAsync,
      ).not.toHaveBeenCalled();
    });
  });

  it("shows placeholders when there is no external id or competition", () => {
    renderDetail({ ...ALICE, external_ids: [], competition_ratings: [] });
    expect(screen.getByText("No external ids yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Not registered in any competition yet."),
    ).toBeInTheDocument();
  });
});
