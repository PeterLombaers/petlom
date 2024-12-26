import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import type { paths } from "./client/schema.js";
import { QueryClient } from "@tanstack/react-query";

const fetchClient = createFetchClient<paths>({
  baseUrl: "http://localhost:8000/",
});
export const apiClient = createClient(fetchClient);
export const queryClient = new QueryClient();
