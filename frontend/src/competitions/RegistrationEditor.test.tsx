import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, makeMockMutation } from "@/test-utils";
import RegistrationEditor from "./RegistrationEditor";
import * as useRegistrationsModule from "./useRegistrations";
import * as apiModule from "@client/api";

vi.mock("./useRegistrations");
vi.mock("@client/api", () => ({
  $api: { useQuery: vi.fn(), useMutation: vi.fn() },
  formatHTTPValidationError: vi.fn(),
}));
vi.mock("@/auth", () => ({ useAuth: () => ({ isModerator: true }) }));
// The new-player button owns the create mutation; the editor only reacts to the
// player it reports back.
const { createMutation } = vi.hoisted(() => ({
  createMutation: { mutate: vi.fn(), isPending: false },
}));
vi.mock("@/players/usePlayers", () => ({
  usePlayers: () => ({ createMutation }),
}));

const mockUseRegistrations = vi.mocked(useRegistrationsModule.useRegistrations);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseQuery = (apiModule.$api as any).useQuery as ReturnType<
  typeof vi.fn
>;

const MOCK_RATING_TYPE = {
  id: 1,
  name: "test_rating",
  algorithm: "elo" as const,
  algorithm_config: null,
  competition_name: "TestComp",
  default_initial_rating: 1500,
  created_at: "2024-01-01T00:00:00",
  updated_at: "2024-01-01T00:00:00",
};

const ALICE = { id: 1, name: "Alice", is_active: true, external_ids: [] };
const BOB = { id: 2, name: "Bob", is_active: true, external_ids: [] };
const CAROL = { id: 3, name: "Carol", is_active: true, external_ids: [] };

/** The dropdown shows the FIDE rating beside the name, `—` when there is none. */
const option = (player: typeof ALICE) => `${player.name} (—)`;

function makeRegistration(id: number, player: typeof ALICE, is_bye = false) {
  return { id, player, is_bye, rating: null };
}

function setupMocks({
  registrations = [] as ReturnType<typeof makeRegistration>[],
  updateMutateOverrides = {},
  deleteMutateOverrides = {},
} = {}) {
  const updateMutation = makeMockMutation(updateMutateOverrides);
  const deleteMutation = makeMockMutation(deleteMutateOverrides);
  const createPairingMutation = makeMockMutation();

  mockUseRegistrations.mockReturnValue({
    registrations,
    isPending: false,
    isError: false,
    error: null,
    updateMutation,
    deleteMutation,
    createPairingMutation,
  } as ReturnType<typeof useRegistrationsModule.useRegistrations>);

  // Return all three players from the players API
  mockUseQuery.mockReturnValue({
    data: [ALICE, BOB, CAROL],
    isPending: false,
    isError: false,
    error: null,
  });

  return { updateMutation, deleteMutation };
}

function renderList(
  registrations = [] as ReturnType<typeof makeRegistration>[],
) {
  const { updateMutation, deleteMutation } = setupMocks({ registrations });
  const onPairingCreated = vi.fn();
  const onDraftCleared = vi.fn();
  render(
    <RegistrationEditor
      competitionName="TestComp"
      roundNr={2}
      ratingType={MOCK_RATING_TYPE}
      onPairingCreated={onPairingCreated}
      onDraftCleared={onDraftCleared}
    />,
  );
  return { updateMutation, deleteMutation, onPairingCreated, onDraftCleared };
}

describe("RegistrationEditor", () => {
  describe("player select", () => {
    it("renders a combobox input for player selection", () => {
      renderList();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("Add button is disabled when no players are selected", () => {
      renderList();
      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    });

    it("filters out enrolled players from the dropdown options", async () => {
      const user = userEvent.setup();
      renderList([makeRegistration(10, ALICE)]);

      // Open the combobox
      await user.click(screen.getByRole("combobox"));

      const listbox = screen.getByRole("listbox");
      expect(
        within(listbox).queryByText(option(ALICE)),
      ).not.toBeInTheDocument();
      expect(within(listbox).getByText(option(BOB))).toBeInTheDocument();
      expect(within(listbox).getByText(option(CAROL))).toBeInTheDocument();
    });

    it("enables Add button after selecting a player", async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(screen.getByRole("combobox"));
      await user.click(screen.getByRole("option", { name: option(ALICE) }));

      expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
    });

    it("calls updateMutation with selected player ids when Add is clicked", async () => {
      const user = userEvent.setup();
      const { updateMutation } = renderList();

      await user.click(screen.getByRole("combobox"));
      await user.click(screen.getByRole("option", { name: option(ALICE) }));
      await user.click(screen.getByRole("option", { name: option(BOB) }));
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(updateMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ player_ids_to_add: [1, 2] }),
        }),
        expect.any(Object),
      );
    });

    it("calls updateMutation when Enter is pressed while the dropdown is closed", async () => {
      const user = userEvent.setup();
      const { updateMutation } = renderList();

      // Open dropdown, select a player, then close dropdown with Escape
      await user.click(screen.getByRole("combobox"));
      await user.click(screen.getByRole("option", { name: option(BOB) }));
      await user.keyboard("{Escape}");
      // Press Enter to add
      await user.keyboard("{Enter}");

      expect(updateMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ player_ids_to_add: [2] }),
        }),
        expect.any(Object),
      );
    });
  });

  describe("new player", () => {
    it("selects the newly created player so it can be added right away", async () => {
      const user = userEvent.setup();
      const dave = { id: 4, name: "Dave", is_active: true, external_ids: [] };
      createMutation.mutate.mockImplementation(
        (
          _variables: unknown,
          options?: { onSuccess?: (data: unknown) => void },
        ) => options?.onSuccess?.(dave),
      );
      const { updateMutation } = renderList();
      // The player exists once the create call succeeded.
      mockUseQuery.mockReturnValue({
        data: [ALICE, BOB, CAROL, dave],
        isPending: false,
        isError: false,
        error: null,
      });

      await user.click(screen.getByRole("button", { name: "Add player" }));
      await user.type(
        within(screen.getByRole("dialog")).getByLabelText(/^Name/),
        "Dave",
      );
      await user.click(screen.getByRole("button", { name: "Save and close" }));
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(updateMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ player_ids_to_add: [4] }),
        }),
        expect.any(Object),
      );
    });
  });

  describe("odd player warning", () => {
    it("shows warning when player count is odd and no bye is set", () => {
      renderList([makeRegistration(10, ALICE)]);
      expect(screen.getByText(/Odd number of players/)).toBeInTheDocument();
    });

    it("warning appears after the table, not before it", () => {
      renderList([makeRegistration(10, ALICE)]);
      const table = screen.getByRole("table");
      const alert =
        screen.getByText(/Odd number of players/).closest("[role='alert']") ??
        screen.getByText(/Odd number of players/).parentElement!;
      // The table should come before the warning in the DOM
      expect(
        table.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("does not show warning when player count is even", () => {
      renderList([makeRegistration(10, ALICE), makeRegistration(11, BOB)]);
      expect(
        screen.queryByText(/Odd number of players/),
      ).not.toBeInTheDocument();
    });
  });

  describe("Clear All", () => {
    it("shows Clear All button", () => {
      renderList();
      expect(
        screen.getByRole("button", { name: "Clear All" }),
      ).toBeInTheDocument();
    });

    it("opens a confirmation modal when Clear All is clicked", async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(screen.getByRole("button", { name: "Clear All" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to clear all players/),
      ).toBeInTheDocument();
    });

    it("does not call deleteMutation when Cancel is clicked in the modal", async () => {
      const user = userEvent.setup();
      const { deleteMutation } = renderList();

      await user.click(screen.getByRole("button", { name: "Clear All" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(deleteMutation.mutate).not.toHaveBeenCalled();
    });

    it("calls deleteMutation when confirmed and invokes onDraftCleared on success", async () => {
      const user = userEvent.setup();
      const onDraftCleared = vi.fn();
      const deleteMutation = makeMockMutation({
        mutate: vi.fn((_args, opts) => opts?.onSuccess?.()),
      });
      const updateMutation = makeMockMutation();
      const createPairingMutation = makeMockMutation();

      mockUseRegistrations.mockReturnValue({
        registrations: [],
        isPending: false,
        isError: false,
        error: null,
        updateMutation,
        deleteMutation,
        createPairingMutation,
      } as ReturnType<typeof useRegistrationsModule.useRegistrations>);

      render(
        <RegistrationEditor
          competitionName="TestComp"
          roundNr={2}
          ratingType={MOCK_RATING_TYPE}
          onPairingCreated={vi.fn()}
          onDraftCleared={onDraftCleared}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Clear All" }));
      // Click the red Confirm button inside the modal
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Clear All" }),
      );

      expect(deleteMutation.mutate).toHaveBeenCalled();
      expect(onDraftCleared).toHaveBeenCalled();
    });
  });
});
