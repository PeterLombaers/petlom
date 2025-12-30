import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import type { paths, components } from "./schema.js";

type HTTPValidationError = components["schemas"]["HTTPValidationError"];
type ValidationError = components["schemas"]["ValidationError"];

const fetchClient = createFetchClient<paths>({
  baseUrl: "http://localhost:8000/",
});

export const $api = createClient(fetchClient);

export const formatValidationError = (error: ValidationError) => {
  const location = error.loc.join(" -> ");
  return `Validation error at ${location}: ${error.msg} (type: ${error.type})`;
};

export const formatHTTPValidationError = (
  error: HTTPValidationError | null
) => {
  if (error === null || error.detail === undefined) {
    return "";
  }
  return error.detail.map((error) => formatValidationError(error)).join("; ");
};
