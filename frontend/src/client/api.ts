import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import type { paths, components } from "./schema.js";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];
type ValidationError = components["schemas"]["ValidationError"];

export const fetchClient = createFetchClient<paths>({
  baseUrl: "/api/",
});

export const $api = createClient(fetchClient);

type HttpMethod = "get" | "put" | "post" | "delete" | "patch";

/** The paths in the schema that support `M`; the others are typed `never`. */
type PathsWithMethod<M extends HttpMethod> = {
  [P in keyof paths]: paths[P][M] extends undefined ? never : P;
}[keyof paths];

/**
 * The React Query key prefix of an endpoint, typed against the OpenAPI schema.
 *
 * `$api` keys its queries as `[method, path, init]`, so this two-element prefix
 * matches every cached variant of the endpoint — invalidating
 * `/competitions/{name}/registrations` covers every round. Because the path is
 * checked against `schema.d.ts`, a renamed endpoint is a compile error instead
 * of an invalidation that silently matches nothing.
 */
export const endpointKey = <M extends HttpMethod, P extends PathsWithMethod<M>>(
  method: M,
  path: P,
) => [method, path] as const;

export const formatValidationError = (error: ValidationError) => {
  const location = error.loc.join(" -> ");
  return `Validation error at ${location}: ${error.msg} (type: ${error.type})`;
};

export const formatHTTPValidationError = (
  error: HTTPValidationError | null,
) => {
  if (error === null || error.detail === undefined) {
    return "";
  }
  // A 4xx/5xx the backend raised itself carries a plain sentence rather than
  // the list of validation errors a 422 does; it is already the message.
  if (typeof error.detail === "string") {
    return error.detail;
  }
  return error.detail.map((error) => formatValidationError(error)).join("; ");
};

export const parseHTTPValidationErrors = (
  error: HTTPValidationError | null,
): Record<string, string> => {
  if (error === null || error.detail === undefined) return {};
  const result: Record<string, string> = {};
  for (const err of error.detail) {
    const field = [...err.loc]
      .reverse()
      .find((l): l is string => typeof l === "string" && l !== "body");
    if (field) result[field] = err.msg;
  }
  return result;
};
