import { UseMutationResult } from "@tanstack/react-query";

// Wildcard mutation type for components that only use .isPending and .mutate().
// `any` on the type params is intentional: it lets callers pass any concretely-typed
// mutation without the component needing to be generic over the full mutation type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMutation = UseMutationResult<any, any, any, any>;
