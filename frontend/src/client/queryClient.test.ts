import { notifications } from "@mantine/notifications";
import type { QueryClient } from "@tanstack/react-query";
import { createQueryClient } from "./queryClient";

vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));

const mockShow = vi.mocked(notifications.show);

let queryClient: QueryClient;

beforeEach(() => {
  mockShow.mockClear();
  // The console keeps every failure whatever `silent` says; the assertions below
  // are about the notification, so keep the noise out of the test output.
  vi.spyOn(console, "error").mockImplementation(() => {});
  queryClient = createQueryClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Runs a mutation that fails with `error`, or succeeds when none is given. */
async function runMutation(
  meta: Record<string, unknown> | undefined,
  error?: unknown,
) {
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationKey: ["post", "/players/"],
    mutationFn: async () => {
      if (error) throw error;
      return null;
    },
    meta,
    retry: false,
  });
  await mutation.execute(undefined).catch(() => {});
}

describe("mutation failures", () => {
  it("are shown to the user", async () => {
    await runMutation(undefined, { detail: "Player already exists." });

    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "red",
        message: "Player already exists.",
      }),
    );
  });

  it("are not shown for a mutation whose caller reports them itself", async () => {
    await runMutation({ silent: true }, { detail: "Player already exists." });

    expect(mockShow).not.toHaveBeenCalled();
  });

  it("are logged even when the notification is suppressed", async () => {
    await runMutation({ silent: true }, { detail: "Player already exists." });

    expect(console.error).toHaveBeenCalled();
  });
});

describe("mutation successes", () => {
  it("are confirmed when the mutation asks for it", async () => {
    await runMutation({ successMessage: "notifications.ratingsImported" });

    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "green",
        message: "Ratings imported.",
      }),
    );
  });

  it("are silent by default", async () => {
    await runMutation(undefined);

    expect(mockShow).not.toHaveBeenCalled();
  });
});
