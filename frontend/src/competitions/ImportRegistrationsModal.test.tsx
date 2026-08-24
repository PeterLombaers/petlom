import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils";
import ImportRegistrationsModal from "./ImportRegistrationsModal";
import * as importModule from "./useRegistrationImport";
import * as apiModule from "@client/api";

vi.mock("./useRegistrationImport", () => ({ useRegistrationImport: vi.fn() }));

vi.mock("@client/api", async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  $api: { useQuery: vi.fn() },
}));

// The create-player dialog is covered by its own tests; here it only has to
// report a player, so the modal can be checked on what it does with one.
vi.mock("@/players/NewPlayerButton", () => ({
  default: ({
    initialName,
    onCreated,
  }: {
    initialName?: string;
    onCreated: (player: {
      id: number;
      name: string;
      is_active: boolean;
    }) => void;
  }) => (
    <button
      onClick={() =>
        onCreated({ id: 9, name: initialName ?? "", is_active: true })
      }
    >
      {`create ${initialName}`}
    </button>
  ),
}));

const mockUseRegistrationImport = vi.mocked(importModule.useRegistrationImport);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseQuery = (apiModule.$api as any).useQuery as ReturnType<
  typeof vi.fn
>;

const player = (id: number, name: string) => ({ id, name, is_active: true });

const ALL_PLAYERS = [
  player(1, "Sander Bakker"),
  player(2, "Wouter Nijhuis"),
  player(3, "Marijke de Vries"),
  player(4, "Lieke van den Bosch"),
  player(5, "Lieke van der Bosch"),
];

const PREVIEW = {
  source_url: "https://club.test/?page_id=1",
  scraped_count: 5,
  matched: [
    {
      scraped_name: "Sander Bakker",
      player: player(1, "Sander Bakker"),
      approximate: false,
      already_registered: false,
    },
    {
      scraped_name: "Wouter Nijhuys",
      player: player(2, "Wouter Nijhuis"),
      approximate: true,
      already_registered: false,
    },
    {
      scraped_name: "Marijke de Vries",
      player: player(3, "Marijke de Vries"),
      approximate: false,
      already_registered: true,
    },
  ],
  unmatched: ["Tom Verhoeven afgemeld"],
  ambiguous: [
    {
      scraped_name: "Lieke van de Bosch",
      candidates: [
        player(4, "Lieke van den Bosch"),
        player(5, "Lieke van der Bosch"),
      ],
    },
  ],
};

type Preview = typeof PREVIEW;

beforeEach(() => {
  mockUseQuery.mockReturnValue({
    data: ALL_PLAYERS,
    error: null,
    isPending: false,
    isError: false,
  });
});

function setupQuery(
  overrides: Partial<{ data: Preview | undefined }> &
    Record<string, unknown> = {},
) {
  mockUseRegistrationImport.mockReturnValue({
    data: PREVIEW,
    error: null,
    isPending: false,
    isError: false,
    ...overrides,
    // The hook is typed against the endpoint; the mock fills in what the modal
    // reads.
  } as unknown as ReturnType<typeof importModule.useRegistrationImport>);
}

// Marijke is the one player of the fixture who is on the round already, which
// is what makes her sign-up the "Already registered" row.
function renderModal(enrolled: number[] = [3]) {
  const onClose = vi.fn();
  const onImport = vi.fn();
  render(
    <ImportRegistrationsModal
      competitionName="interne_2024"
      roundNr={5}
      enrolledPlayerIds={new Set(enrolled)}
      onClose={onClose}
      onImport={onImport}
    />,
  );
  return { onClose, onImport };
}

const row = (name: RegExp) => screen.getByRole("row", { name });

describe("ImportRegistrationsModal", () => {
  it("gives every sign-up a row, and says what the matcher made of it", () => {
    setupQuery();
    renderModal();

    expect(screen.getByText("Recognised 3 of 5 sign-ups.")).toBeInTheDocument();
    expect(row(/Wouter Nijhuys/)).toHaveTextContent("Spelled differently");
    expect(row(/Marijke de Vries/)).toHaveTextContent("Already registered");
    expect(row(/Lieke van de Bosch/)).toHaveTextContent("No unique match");
    expect(
      within(row(/Lieke van de Bosch/)).getByText(
        "Lieke van den Bosch, Lieke van der Bosch",
      ),
    ).toBeInTheDocument();
    expect(row(/Tom Verhoeven afgemeld/)).toHaveTextContent("No match");
  });

  it("prefills the matched rows and leaves the unresolved ones empty", () => {
    setupQuery();
    renderModal();

    expect(
      within(row(/Wouter Nijhuys/)).getByRole("combobox"),
    ).toHaveDisplayValue("Wouter Nijhuis");
    expect(
      within(row(/Tom Verhoeven afgemeld/)).getByRole("combobox"),
    ).toHaveDisplayValue("");
  });

  it("hands over only the players that are not registered yet", async () => {
    const user = userEvent.setup();
    setupQuery();
    const { onClose, onImport } = renderModal();

    await user.click(screen.getByRole("button", { name: "Select 2 players" }));

    expect(onImport).toHaveBeenCalledWith([1, 2]);
    expect(onClose).toHaveBeenCalled();
  });

  it("leaves out a row that is unchecked", async () => {
    const user = userEvent.setup();
    setupQuery();
    const { onImport } = renderModal();

    await user.click(
      screen.getByRole("checkbox", { name: "Import Sander Bakker" }),
    );
    await user.click(screen.getByRole("button", { name: "Select 1 player" }));

    expect(onImport).toHaveBeenCalledWith([2]);
  });

  it("imports a player picked by hand for a name with no unique match", async () => {
    const user = userEvent.setup();
    setupQuery();
    const { onImport } = renderModal();

    await user.click(within(row(/Lieke van de Bosch/)).getByRole("combobox"));
    await user.click(
      await screen.findByRole("option", { name: "Lieke van der Bosch" }),
    );

    expect(
      screen.getByRole("checkbox", { name: "Import Lieke van de Bosch" }),
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Select 3 players" }));
    expect(onImport).toHaveBeenCalledWith([1, 2, 5]);
  });

  it("offers the players already taken by another row nowhere else", async () => {
    const user = userEvent.setup();
    setupQuery();
    renderModal();

    await user.click(within(row(/Tom Verhoeven/)).getByRole("combobox"));

    expect(
      await screen.findByRole("option", { name: "Lieke van den Bosch" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Sander Bakker" }),
    ).not.toBeInTheDocument();
  });

  it("imports a player created for a name it did not recognise", async () => {
    const user = userEvent.setup();
    setupQuery();
    const { onImport } = renderModal();

    await user.click(
      screen.getByRole("button", { name: "create Tom Verhoeven afgemeld" }),
    );

    await user.click(screen.getByRole("button", { name: "Select 3 players" }));
    expect(onImport).toHaveBeenCalledWith([1, 2, 9]);
  });

  it("has nothing to select when everyone is already registered", () => {
    setupQuery({
      data: { ...PREVIEW, unmatched: [], ambiguous: [] },
    });
    renderModal([1, 2, 3]);

    expect(
      screen.getByRole("button", { name: "Select 0 players" }),
    ).toBeDisabled();
  });

  it("offers no tick on a sign-up by someone the round already has", () => {
    setupQuery();
    renderModal();

    expect(
      within(row(/Marijke de Vries/)).queryByRole("checkbox"),
    ).not.toBeInTheDocument();
    expect(
      within(row(/Sander Bakker/)).getByRole("checkbox"),
    ).toBeInTheDocument();
  });

  it("offers a player the round already has to no row", async () => {
    const user = userEvent.setup();
    setupQuery();
    renderModal();

    await user.click(within(row(/Tom Verhoeven/)).getByRole("combobox"));

    expect(
      await screen.findByRole("option", { name: "Lieke van den Bosch" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Marijke de Vries" }),
    ).not.toBeInTheDocument();
  });

  it("says so when nobody has signed up", () => {
    setupQuery({
      data: {
        ...PREVIEW,
        scraped_count: 0,
        matched: [],
        unmatched: [],
        ambiguous: [],
      },
    });
    renderModal();

    expect(
      screen.getByText("Nobody has signed up on the website yet."),
    ).toBeInTheDocument();
  });

  it("shows the error of a failed run", () => {
    setupQuery({
      data: undefined,
      isError: true,
      error: { detail: "Club website request failed" },
    });
    renderModal();

    expect(screen.getByText("Club website request failed")).toBeInTheDocument();
  });
});
