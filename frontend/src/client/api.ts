import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import type { paths, components } from "./schema.js";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];
type ValidationError = components["schemas"]["ValidationError"];

export const fetchClient = createFetchClient<paths>({
  baseUrl: "/api/",
});

export const $api = createClient(fetchClient);

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
