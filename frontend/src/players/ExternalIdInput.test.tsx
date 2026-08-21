import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils";
import ExternalIdInput from "./ExternalIdInput";
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

const CARLSEN = {
  source: "fide" as const,
  external_id: "1503014",
  name: "Carlsen, Magnus",
  country: "NOR",
  title: "GM",
  rating: 2839,
  list_date: null,
};

function renderInput(value = "", results = [CARLSEN]) {
  mockUseQuery.mockReturnValue({ data: results, isFetching: false });
  const onChange = vi.fn();
  render(
    <ExternalIdInput
      source="fide"
      playerName="Magnus Carlsen"
      value={value}
      onChange={onChange}
    />,
  );
  return onChange;
}

/** The query of the last `useQuery` call, i.e. what is being searched for. */
function lastQuery() {
  const calls = mockUseQuery.mock.calls;
  return calls[calls.length - 1][2].params.query.query;
}

describe("ExternalIdInput", () => {
  it("searches for the player's name while the field is empty", () => {
    renderInput();
    expect(lastQuery()).toBe("Magnus Carlsen");
  });

  it("searches for what was typed instead, once it is long enough", async () => {
    const user = userEvent.setup({ delay: null });
    renderInput("1503014");

    await user.click(screen.getByRole("combobox"));

    expect(lastQuery()).toBe("1503014");
  });

  it("shows who each candidate is, and its identifier", async () => {
    const user = userEvent.setup();
    renderInput();

    await user.click(screen.getByRole("combobox"));

    const option = await screen.findByRole("option");
    expect(option).toHaveTextContent("Carlsen, Magnus — NOR GM (2839)");
    expect(option).toHaveTextContent("1503014");
  });

  it("puts the identifier of the chosen player in the field", async () => {
    const user = userEvent.setup();
    const onChange = renderInput();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option"));

    expect(onChange).toHaveBeenLastCalledWith("1503014");
  });

  it("names the player the identifier in the field belongs to", () => {
    renderInput("1503014");

    expect(screen.getByRole("combobox")).toHaveAccessibleDescription(
      "Carlsen, Magnus — NOR GM (2839)",
    );
  });

  it("still accepts an identifier typed by hand", async () => {
    const user = userEvent.setup();
    const onChange = renderInput();

    await user.type(screen.getByRole("combobox"), "2");

    expect(onChange).toHaveBeenCalledWith("2");
  });
});
