import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, makeMockMutation } from "@/test-utils";
import { MatchTable } from "./MatchTable";
import type { components } from "@client/schema";

type MatchPublic = components["schemas"]["MatchPublic"];
type Role = components["schemas"]["Role"];

const mockRole = vi.fn<() => Role | null>(() => "moderator");
vi.mock("@/auth", () => ({
  useAuth: () => ({
    role: mockRole(),
    isModerator: mockRole() === "moderator",
    isAuthenticated: mockRole() !== null,
  }),
}));

const editMutation = makeMockMutation();
const queryResult = {
  rows: [] as MatchPublic[],
  isPending: false,
  isError: false,
  error: null,
  createMutation: makeMockMutation(),
  editMutation,
  deleteMutation: makeMockMutation(),
};
vi.mock("./useMatches", () => ({ useMatches: () => queryResult }));

const match = (id: number, board: number): MatchPublic => ({
  id,
  board,
  round: 1,
  result: null,
  competition_name: "simkro",
  player_white_id: 10 * id,
  player_black_id: 10 * id + 1,
  player_white: { id: 10 * id, name: `White ${id}`, is_active: true },
  player_black: { id: 10 * id + 1, name: `Black ${id}`, is_active: true },
  created_at: "2024-01-01T00:00:00",
  updated_at: "2024-01-01T00:00:00",
});

beforeEach(() => {
  queryResult.rows = [match(1, 1), match(2, 2)];
  vi.clearAllMocks();
  mockRole.mockReturnValue("moderator");
});

const renderTable = () =>
  render(<MatchTable competitionName="simkro" round={1} />);

const resultHeader = () =>
  screen.getByRole("columnheader", { name: /result/i });

/** Enter column edit on the result column and save the first row as 1-0. */
const setFirstResult = async () => {
  const user = userEvent.setup();
  await user.click(
    within(resultHeader()).getByRole("button", { name: "Edit" }),
  );
  const [firstToggle] = screen.getAllByRole("radio", { name: "1-0" });
  await user.click(firstToggle);
  await user.click(screen.getByRole("button", { name: "Save" }));
};

describe("MatchTable", () => {
  describe("as a result keeper", () => {
    beforeEach(() => mockRole.mockReturnValue("result_keeper"));

    it("can edit the result column and nothing else", () => {
      renderTable();
      expect(
        within(resultHeader()).getByRole("button", { name: "Edit" }),
      ).toBeInTheDocument();
      // No Add, no Delete, no per-row Edit, no CSV export.
      expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
      expect(
        screen.queryByRole("button", { name: /Add/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Delete/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("columnheader", { name: "Actions" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /export/i }),
      ).not.toBeInTheDocument();
    });

    it("sends a body of nothing but the result", async () => {
      renderTable();
      await setFirstResult();
      // Anything more than `result` is a 403 from `update_match`.
      expect(editMutation.mutateAsync).toHaveBeenCalledTimes(1);
      expect(editMutation.mutateAsync).toHaveBeenCalledWith({
        body: { result: "1-0" },
        params: { path: { id: 1 } },
      });
    });
  });

  describe("as a moderator", () => {
    it("still sends the whole row", async () => {
      renderTable();
      await setFirstResult();
      expect(editMutation.mutateAsync).toHaveBeenCalledWith({
        body: {
          player_white_id: 10,
          player_black_id: 11,
          board: 1,
          result: "1-0",
        },
        params: { path: { id: 1 } },
      });
    });

    it("keeps the full editing UI", () => {
      renderTable();
      expect(
        screen.getByRole("columnheader", { name: "Actions" }),
      ).toBeInTheDocument();
    });
  });

  describe("anonymously", () => {
    it("offers no editing at all", () => {
      mockRole.mockReturnValue(null);
      renderTable();
      expect(
        screen.queryByRole("button", { name: "Edit" }),
      ).not.toBeInTheDocument();
    });
  });
});
