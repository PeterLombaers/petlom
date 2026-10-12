import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeMockMutation, render } from "@/test-utils";
import { PublishButton } from "./PublishButton";
import * as publicationModule from "./usePublication";
import * as matchesModule from "@/matches/useMatches";

const mockIsModerator = vi.fn(() => true);
vi.mock("@/auth", () => ({
  useAuth: () => ({ isModerator: mockIsModerator() }),
}));
vi.mock("./usePublication", () => ({ usePublication: vi.fn() }));
vi.mock("@/matches/useMatches", () => ({ useMatches: vi.fn() }));

const mockUsePublication = vi.mocked(publicationModule.usePublication);
const mockUseMatches = vi.mocked(matchesModule.useMatches);

type Publication = {
  enabled: boolean;
  round_nr: number;
  url?: string | null;
  published_at?: string | null;
  with_results?: boolean | null;
};

function setup({
  publication = { enabled: true, round_nr: 3 },
  results = [null, null],
}: {
  publication?: Publication;
  results?: (string | null)[];
} = {}) {
  const publish = vi.fn();
  mockUsePublication.mockReturnValue({
    publication: { data: publication },
    publishMutation: makeMockMutation(),
    publish,
  } as unknown as ReturnType<typeof publicationModule.usePublication>);
  mockUseMatches.mockReturnValue({
    rows: results.map((result, i) => ({ id: i, result })),
  } as unknown as ReturnType<typeof matchesModule.useMatches>);
  return publish;
}

const renderButton = (categoryIds: number[] = [14]) =>
  render(
    <PublishButton
      competitionName="interne"
      roundNr={3}
      categoryIds={categoryIds}
    />,
  );

const openDialog = async () =>
  userEvent.click(screen.getByRole("button", { name: "Publish" }));

describe("PublishButton", () => {
  beforeEach(() => {
    mockIsModerator.mockReturnValue(true);
  });

  it("renders nothing for a non-moderator", () => {
    mockIsModerator.mockReturnValue(false);
    setup();
    renderButton();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing when publishing is not configured", () => {
    setup({ publication: { enabled: false, round_nr: 3 } });
    renderButton();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers the pairings while results are missing", async () => {
    setup({ results: ["1-0", null] });
    renderButton();
    await openDialog();
    expect(
      screen.getByText("The pairings of round 3 will be published."),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 results are in/)).toBeInTheDocument();
    expect(
      screen.getByText("This creates a new post on the club website."),
    ).toBeInTheDocument();
  });

  it("offers the results once every result is in", async () => {
    setup({
      results: ["1-0", "0-1"],
      publication: {
        enabled: true,
        round_nr: 3,
        url: "https://club.test/?p=7",
        published_at: "2026-10-12T19:04:00",
        with_results: false,
      },
    });
    renderButton();
    await openDialog();
    expect(
      screen.getByText(
        "The results of round 3 and the ranking after it will be published.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This replaces the post published on/),
    ).toBeInTheDocument();
  });

  it("warns when the competition has no categories", async () => {
    setup();
    renderButton([]);
    await openDialog();
    expect(screen.getByText(/has no website categories/)).toBeInTheDocument();
  });

  it("publishes on confirmation", async () => {
    const publish = setup();
    renderButton();
    await openDialog();
    const buttons = screen.getAllByRole("button", { name: "Publish" });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(publish).toHaveBeenCalledOnce();
  });
});
