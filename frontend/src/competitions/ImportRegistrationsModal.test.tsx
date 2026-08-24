import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils";
import ImportRegistrationsModal from "./ImportRegistrationsModal";
import * as importModule from "./useRegistrationImport";

vi.mock("./useRegistrationImport", () => ({ useRegistrationImport: vi.fn() }));

const mockUseRegistrationImport = vi.mocked(importModule.useRegistrationImport);

const player = (id: number, name: string) => ({ id, name, is_active: true });

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

function renderModal() {
  const onClose = vi.fn();
  const onImport = vi.fn();
  render(
    <ImportRegistrationsModal
      competitionName="interne_2024"
      roundNr={5}
      onClose={onClose}
      onImport={onImport}
    />,
  );
  return { onClose, onImport };
}

describe("ImportRegistrationsModal", () => {
  it("reports what was recognised and what was not", () => {
    setupQuery();
    renderModal();

    expect(screen.getByText("Recognised 3 of 5 sign-ups.")).toBeInTheDocument();
    expect(
      screen.getByRole("row", { name: /Wouter Nijhuys/ }),
    ).toHaveTextContent("Spelled differently");
    expect(
      screen.getByRole("row", { name: /Marijke de Vries/ }),
    ).toHaveTextContent("Already registered");
    expect(
      screen.getByText(/Lieke van den Bosch, Lieke van der Bosch/),
    ).toBeInTheDocument();
    expect(screen.getByText("Tom Verhoeven afgemeld")).toBeInTheDocument();
  });

  it("hands over only the players that are not registered yet", async () => {
    const user = userEvent.setup();
    setupQuery();
    const { onClose, onImport } = renderModal();

    await user.click(screen.getByRole("button", { name: "Select 2 players" }));

    expect(onImport).toHaveBeenCalledWith([1, 2]);
    expect(onClose).toHaveBeenCalled();
  });

  it("has nothing to select when everyone is already registered", () => {
    setupQuery({
      data: {
        ...PREVIEW,
        matched: PREVIEW.matched.map((m) => ({
          ...m,
          already_registered: true,
        })),
      },
    });
    renderModal();

    expect(
      screen.getByRole("button", { name: "Select 0 players" }),
    ).toBeDisabled();
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
