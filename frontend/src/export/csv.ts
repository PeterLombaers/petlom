import { fetchClient } from "@/client/api";

/**
 * The CSV endpoints, keyed the way `fetchClient.GET` wants them.
 *
 * Listing them here rather than typing the parameter as `string` keeps a
 * renamed backend route a compile error, the same reason `endpointKey` exists.
 */
export type CsvExportPath =
  | "/competitions/{name}/pairing/export"
  | "/competitions/{name}/ranking/export";

/** The `filename*=UTF-8''...` (or plain `filename=`) of a Content-Disposition. */
export function filenameFromDisposition(
  disposition: string | null,
): string | null {
  if (!disposition) return null;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      // A malformed header is not worth failing the download over.
      return null;
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : null;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Download a CSV export and hand it to the browser as a file.
 *
 * Goes through `fetchClient` rather than a bare `fetch` or an `<a href>` so the
 * request picks up the `Authorization` header and the 401 handling that
 * `AuthProvider` installs as middleware — these endpoints are moderator-only.
 *
 * Throws when the request fails, so the caller can report it.
 */
export async function downloadCsv(
  path: CsvExportPath,
  name: string,
  /** Omitted exports the latest round, as the endpoint's default does. */
  roundNr: number | undefined,
  fallbackFilename: string,
) {
  const { data, error, response } = await fetchClient.GET(path, {
    params: { path: { name }, query: { round_nr: roundNr } },
    parseAs: "blob",
  });
  if (error !== undefined || !response.ok || data === undefined) {
    throw new Error(`Export failed (${response.status})`);
  }
  const filename =
    filenameFromDisposition(response.headers.get("Content-Disposition")) ??
    fallbackFilename;
  saveBlob(data as unknown as Blob, filename);
}
