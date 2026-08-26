import { QueryClient, MutationCache } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/ui/notify";
import i18n from "@/i18n";

/**
 * Every mutation failure is reported here, so no hook has to remember to do it.
 *
 * A mutation opts out with `meta: { silent: true }` when its caller renders the error
 * in a better place — 422 field errors belong next to the field, not in a toast. Query
 * failures are deliberately not here: a page that failed to load needs `ErrorState` in
 * place of its content, not a message that disappears.
 *
 * A factory rather than one shared client: a test needs a client of its own, and the
 * app makes exactly one at startup.
 */
export function createQueryClient() {
  const mutationCache = new MutationCache({
    onError: (error, variables, _onMutateResult, mutation) => {
      console.error("Mutation failed", mutation.options.mutationKey, {
        error,
        variables,
      });
      if (mutation.meta?.silent) return;
      notifyError(error);
    },
    onSuccess: (_data, _variables, _onMutateResult, mutation) => {
      const { successMessage } = mutation.meta ?? {};
      if (successMessage) notifySuccess(i18n.t(successMessage));
    },
  });

  return new QueryClient({ mutationCache });
}
