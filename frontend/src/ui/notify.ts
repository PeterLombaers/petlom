import { notifications } from "@mantine/notifications";
import { formatHTTPValidationError } from "@/client/api";
import type { components } from "@/client/schema";
import i18n from "@/i18n";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];

/**
 * The message to show the user for a failed request.
 *
 * The backend's own `detail` sentence is the best message there is, so it is shown
 * verbatim. Everything else — a network failure, a 500 with no body, a thrown
 * `Error` — has no sentence worth showing and gets the generic one, which is kept
 * short because this also lands in a table cell, not only in a notification.
 */
export function describeError(error: unknown): string {
  const detail = (error as HTTPValidationError | null)?.detail;
  const message =
    detail === undefined
      ? ""
      : formatHTTPValidationError(error as HTTPValidationError);
  return message || i18n.t("errors.unexpected");
}

/**
 * Report a failure to the user.
 *
 * Called from the global `MutationCache` handler in `App.tsx`, which is outside React,
 * so this uses the i18next singleton rather than `useTranslation`. `notifications.show`
 * is callable anywhere for the same reason.
 */
export function notifyError(error: unknown) {
  notifications.show({
    color: "red",
    title: i18n.t("common.error"),
    message: describeError(error),
    autoClose: 8000,
  });
}

/** Confirm an action whose success is not already visible on the page. */
export function notifySuccess(message: string) {
  notifications.show({ color: "green", message, autoClose: 4000 });
}
