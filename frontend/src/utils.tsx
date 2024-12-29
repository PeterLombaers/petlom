import createFetchClient from "openapi-fetch";
import type { paths } from "./client/schema.js";
import { QueryClient } from "@tanstack/react-query";

export const apiClient = createFetchClient<paths>({
  baseUrl: "http://localhost:8000/",
});
export const queryClient = new QueryClient();
