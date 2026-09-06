import { filenameFromDisposition } from "./csv";

describe("filenameFromDisposition", () => {
  it("decodes the RFC 5987 filename the backend sends", () => {
    expect(
      filenameFromDisposition(
        "attachment; filename*=UTF-8''interne%202024_ronde_3_stand.csv",
      ),
    ).toBe("interne 2024_ronde_3_stand.csv");
  });

  it("falls back to a plain filename parameter", () => {
    expect(filenameFromDisposition('attachment; filename="stand.csv"')).toBe(
      "stand.csv",
    );
  });

  it("returns null when there is no header to read", () => {
    expect(filenameFromDisposition(null)).toBeNull();
    expect(filenameFromDisposition("attachment")).toBeNull();
  });

  it("returns null for a percent-encoding it cannot decode", () => {
    expect(
      filenameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A"),
    ).toBeNull();
  });
});
