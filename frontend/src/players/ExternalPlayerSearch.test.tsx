import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils";
import ExternalPlayerSearch from "./ExternalPlayerSearch";
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

const CARLSEN = {
  source: "fide" as const,
  external_id: "1503014",
  name: "Carlsen, Magnus",
  country: "NOR",
  title: "GM",
  rating: 2839,
  list_date: null,
};

function renderSearch(
  results: (typeof CARLSEN)[] = [CARLSEN],
  source: "fide" | "knsb" = "fide",
) {
  mockUseQuery.mockReturnValue({ data: results, isFetching: false });
  const onSelect = vi.fn();
  render(<ExternalPlayerSearch source={source} onSelect={onSelect} />);
  return onSelect;
}

describe("ExternalPlayerSearch", () => {
  beforeEach(() => {
    mockIsModerator.mockReturnValue(true);
  });

  it("searches the source it was given, once the query is long enough", async () => {
    const user = userEvent.setup();
    renderSearch([], "knsb");

    await user.type(
      screen.getByRole("combobox", { name: "Search KNSB" }),
      "Ja",
    );

    const calls = mockUseQuery.mock.calls;
    const [, path, options, queryOptions] = calls[calls.length - 1];
    expect(path).toBe("/external/{source}/search/");
    expect(options.params.path).toEqual({ source: "knsb" });
    expect(queryOptions.enabled).toBe(false); // still debouncing
  });

  it("hands the chosen result to onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = renderSearch();

    await user.click(screen.getByRole("combobox", { name: "Search FIDE" }));
    await user.click(
      await screen.findByRole("option", {
        name: "Carlsen, Magnus — NOR GM (2839)",
      }),
    );

    expect(onSelect).toHaveBeenCalledWith(CARLSEN);
  });

  it("renders nothing for a user who may not search", () => {
    mockIsModerator.mockReturnValue(false);
    renderSearch();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
