import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, makeMockMutation } from "@/test-utils";
import PlayerTable from "./PlayerTable";
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
    {
      id: 11,
      source: "knsb" as const,
      external_id: "9055882",
      created_at: "2024-01-01T00:00:00",
      updated_at: "2024-01-01T00:00:00",
      rating: {
        id: 101,
        player_external_id_id: 11,
        source: "knsb" as const,
        rating: 1750,
        list_date: "2026-05",
        imported_at: "2026-05-02T00:00:00",
      },
    },
  ],
};

const BOB = {
  id: 2,
  name: "Bob",
  is_active: true,
  created_at: "2024-01-01T00:00:00",
  updated_at: "2024-01-01T00:00:00",
  external_ids: [],
};

/** One mock mutation per endpoint, so a test can assert which one was called. */
function setupMocks(players = [ALICE, BOB]) {
  const mutations = {
    "patch /players/{id}/": makeMockMutation(),
    "put /players/{id}/external-ids/{source}/": makeMockMutation(),
    "delete /players/{id}/external-ids/{source}/": makeMockMutation(),
    "post /players/": makeMockMutation(),
    "delete /players/{id}/": makeMockMutation(),
    "post /external/{source}/import/": makeMockMutation(),
  };
  mockUseMutation.mockImplementation(
    (method: string, path: string) =>
      mutations[`${method} ${path}` as keyof typeof mutations] ??
      makeMockMutation(),
  );
  mockUseQuery.mockImplementation((_method: string, path: string) =>
    // The identifier cells search the rating source as they are edited.
    path === "/external/{source}/search/"
      ? { data: [], isFetching: false }
      : { data: players, isPending: false, isError: false, error: null },
  );
  return mutations;
}

function renderTable(players = [ALICE, BOB]) {
  const mutations = setupMocks(players);
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlayerTable />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return mutations;
}

/** Opens row edit for `name` and returns its edit input. */
async function startRowEdit(user: ReturnType<typeof userEvent.setup>) {
  const row = screen.getByRole("row", { name: /Alice/ });
  await user.click(within(row).getByRole("button", { name: "Edit" }));
  return row;
}

describe("PlayerTable", () => {
  beforeEach(() => {
    mockIsModerator.mockReturnValue(true);
  });

  describe("columns", () => {
    it("renders the rating of each source, and an em dash without one", () => {
      renderTable();
      expect(screen.getByText("2839")).toBeInTheDocument();
      expect(screen.getByText("1750")).toBeInTheDocument();
      const bobRow = screen.getByRole("row", { name: /Bob/ });
      // One per source, since Bob has neither.
      expect(within(bobRow).getAllByText("—")).toHaveLength(2);
    });

    it("links the name to the player detail page", () => {
      renderTable();
      expect(screen.getByRole("link", { name: "Alice" })).toHaveAttribute(
        "href",
        "/players/1",
      );
    });

    it("links the FIDE id to the FIDE profile", () => {
      renderTable();
      const link = screen.getByRole("link", { name: "1503014" });
      expect(link).toHaveAttribute(
        "href",
        "https://ratings.fide.com/profile/1503014",
      );
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("does not link a KNSB id, which has no public profile page", () => {
      renderTable();
      expect(screen.getByText("9055882")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "9055882" })).toBeNull();
    });

    it("does not link the FIDE id of a player without one", () => {
      renderTable();
      const bobRow = screen.getByRole("row", { name: /Bob/ });
      // Only the name links; the empty FIDE id has no profile to point at.
      expect(within(bobRow).getAllByRole("link")).toHaveLength(1);
      expect(within(bobRow).getByRole("link")).toHaveAttribute(
        "href",
        "/players/2",
      );
    });
  });

  describe("editing", () => {
    it("patches the player when the name changed", async () => {
      const user = userEvent.setup();
      const mutations = renderTable();

      const row = await startRowEdit(user);
      const nameInput = within(row).getByRole("textbox", { name: "Name" });
      await user.clear(nameInput);
      await user.type(nameInput, "Alicia");
      await user.click(within(row).getByRole("button", { name: "Save" }));

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

    it("puts the external id when the FIDE id changed", async () => {
      const user = userEvent.setup();
      const mutations = renderTable();

      const row = await startRowEdit(user);
      const fideInput = within(row).getByRole("combobox", {
        name: /FIDE ID of Alice/,
      });
      await user.clear(fideInput);
      await user.type(fideInput, "24116068");
      await user.click(within(row).getByRole("button", { name: "Save" }));

      expect(
        mutations["put /players/{id}/external-ids/{source}/"].mutateAsync,
      ).toHaveBeenCalledWith({
        body: { external_id: "24116068" },
        params: { path: { id: 1, source: "fide" } },
      });
      expect(
        mutations["patch /players/{id}/"].mutateAsync,
      ).not.toHaveBeenCalled();
    });

    it("puts the external id of the source whose column changed", async () => {
      const user = userEvent.setup();
      const mutations = renderTable();

      const row = await startRowEdit(user);
      const knsbInput = within(row).getByRole("combobox", {
        name: /KNSB ID of Alice/,
      });
      await user.clear(knsbInput);
      await user.type(knsbInput, "9000001");
      await user.click(within(row).getByRole("button", { name: "Save" }));

      expect(
        mutations["put /players/{id}/external-ids/{source}/"].mutateAsync,
      ).toHaveBeenCalledWith({
        body: { external_id: "9000001" },
        params: { path: { id: 1, source: "knsb" } },
      });
    });

    it("deletes the external id when the FIDE id is cleared", async () => {
      const user = userEvent.setup();
      const mutations = renderTable();

      const row = await startRowEdit(user);
      await user.clear(
        within(row).getByRole("combobox", { name: /FIDE ID of Alice/ }),
      );
      await user.click(within(row).getByRole("button", { name: "Save" }));

      expect(
        mutations["delete /players/{id}/external-ids/{source}/"].mutateAsync,
      ).toHaveBeenCalledWith({
        params: { path: { id: 1, source: "fide" } },
      });
    });
  });

  describe("import menu", () => {
    /** Opens the import menu and picks a source from it. */
    async function importFrom(
      user: ReturnType<typeof userEvent.setup>,
      sourceName: string,
    ) {
      await user.click(screen.getByRole("button", { name: "Import ratings" }));
      await user.click(
        await screen.findByRole("menuitem", { name: sourceName }),
      );
    }

    it("imports ratings of the chosen source for every player", async () => {
      const user = userEvent.setup();
      const mutations = renderTable();

      await importFrom(user, "FIDE");

      expect(
        mutations["post /external/{source}/import/"].mutate,
      ).toHaveBeenCalledWith({
        params: { path: { source: "fide" } },
        body: { update_existing: false },
      });
    });

    it("imports from the other source too", async () => {
      const user = userEvent.setup();
      const mutations = renderTable();

      await importFrom(user, "KNSB");

      expect(
        mutations["post /external/{source}/import/"].mutate,
      ).toHaveBeenCalledWith({
        params: { path: { source: "knsb" } },
        body: { update_existing: false },
      });
    });
  });

  describe("finding ids", () => {
    it("opens the search dialog", async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(screen.getByRole("button", { name: "Find IDs" }));

      expect(
        await screen.findByRole("dialog", { name: "Find IDs" }),
      ).toBeInTheDocument();
    });

    it("is hidden from a user who may not search", () => {
      mockIsModerator.mockReturnValue(false);
      renderTable();

      expect(screen.queryByRole("button", { name: "Find IDs" })).toBeNull();
    });
  });
});
