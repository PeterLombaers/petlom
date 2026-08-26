import { notifications } from "@mantine/notifications";
import { describeError, notifyError, notifySuccess } from "./notify";

vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));

const mockShow = vi.mocked(notifications.show);

beforeEach(() => {
  mockShow.mockClear();
});

describe("describeError", () => {
  it("shows the sentence the backend sent", () => {
    expect(describeError({ detail: "Competition already finished." })).toBe(
      "Competition already finished.",
    );
  });

  it("joins the messages of a 422", () => {
    const error = {
      detail: [
        { loc: ["body", "name"], msg: "Field required", type: "missing" },
        {
          loc: ["body", "rating"],
          msg: "Input should be a valid integer",
          type: "int_type",
        },
      ],
    };
    expect(describeError(error)).toBe(
      "Validation error at body -> name: Field required (type: missing); " +
        "Validation error at body -> rating: Input should be a valid integer (type: int_type)",
    );
  });

  it("falls back to a generic message when there is no detail", () => {
    expect(describeError({})).toBe("Something went wrong.");
  });

  // A dropped connection rejects with an Error, not a parsed response body.
  it("falls back to a generic message for a thrown Error", () => {
    expect(describeError(new Error("Failed to fetch"))).toBe(
      "Something went wrong.",
    );
  });

  it("falls back to a generic message for null", () => {
    expect(describeError(null)).toBe("Something went wrong.");
  });
});

describe("notifyError", () => {
  it("shows the error in red, under the Error title", () => {
    notifyError({ detail: "Competition already finished." });

    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "red",
        title: "Error",
        message: "Competition already finished.",
      }),
    );
  });
});

describe("notifySuccess", () => {
  it("shows the message in green", () => {
    notifySuccess("Ratings imported.");

    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ color: "green", message: "Ratings imported." }),
    );
  });
});
