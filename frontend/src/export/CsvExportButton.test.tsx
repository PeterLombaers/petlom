import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils";
import { CsvExportButton } from "./CsvExportButton";
import * as csvModule from "./csv";

const mockIsModerator = vi.fn(() => true);
vi.mock("@/auth", () => ({
  useAuth: () => ({ isModerator: mockIsModerator() }),
}));
vi.mock("./csv", async (importOriginal) => ({
  ...(await importOriginal<typeof csvModule>()),
  downloadCsv: vi.fn(),
}));

const mockDownloadCsv = vi.mocked(csvModule.downloadCsv);

const renderButton = () =>
  render(
    <CsvExportButton
      path="/competitions/{name}/ranking/export"
      competitionName="interne"
      roundNr={3}
      fallbackFilename="interne_ronde_3_stand.csv"
    />,
  );

describe("CsvExportButton", () => {
  beforeEach(() => {
    mockIsModerator.mockReturnValue(true);
    mockDownloadCsv.mockReset();
  });

  it("renders nothing for a non-moderator", () => {
    mockIsModerator.mockReturnValue(false);
    renderButton();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("downloads the export when clicked", async () => {
    mockDownloadCsv.mockResolvedValue(undefined);
    renderButton();
    await userEvent.click(screen.getByRole("button"));
    expect(mockDownloadCsv).toHaveBeenCalledWith(
      "/competitions/{name}/ranking/export",
      "interne",
      3,
      "interne_ronde_3_stand.csv",
    );
  });

  it("notifies when the download fails", async () => {
    mockDownloadCsv.mockRejectedValue(new Error("boom"));
    renderButton();
    await userEvent.click(screen.getByRole("button"));
    expect(
      await screen.findByText("The export could not be downloaded."),
    ).toBeInTheDocument();
  });
});
