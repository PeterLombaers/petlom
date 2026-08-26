import {
  QueryClientProvider,
  QueryClient,
  MutationCache,
} from "@tanstack/react-query";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { theme } from "./theme";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import {
  CompetitionListPage,
  CompetitionDetailPage,
  PlayerListPage,
  PlayerDetailPage,
  LoginPage,
  NotFoundPage,
} from "./pages";
import Layout from "./layout/Layout";
import { AuthProvider } from "./auth";
import { notifyError, notifySuccess } from "./ui/notify";
import i18n from "./i18n";

/**
 * Every mutation failure is reported here, so no hook has to remember to do it.
 *
 * A mutation opts out with `meta: { silent: true }` when its caller renders the error
 * in a better place — 422 field errors belong next to the field, not in a toast. Query
 * failures are deliberately not here: a page that failed to load needs `ErrorState` in
 * place of its content, not a message that disappears.
 */
const mutationCache = new MutationCache({
  onError: (error, _variables, _onMutateResult, mutation) => {
    if (mutation.meta?.silent) return;
    notifyError(error);
  },
  onSuccess: (_data, _variables, _onMutateResult, mutation) => {
    const { successMessage } = mutation.meta ?? {};
    if (successMessage) notifySuccess(i18n.t(successMessage));
  },
});

const queryClient = new QueryClient({ mutationCache });

declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__: import("@tanstack/query-core").QueryClient;
  }
}

window.__TANSTACK_QUERY_CLIENT__ = queryClient;

function App() {
  return (
    <>
      <ColorSchemeScript defaultColorScheme="auto" />
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications position="top-right" />
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<Layout />}>
                  <Route
                    index
                    element={<Navigate to="/competitions" replace />}
                  />
                  <Route
                    path="/competitions"
                    element={<CompetitionListPage />}
                  ></Route>
                  <Route
                    path="/competitions/:name"
                    element={<CompetitionDetailPage />}
                  ></Route>
                  <Route
                    path="/competitions/:name/round/:round"
                    element={<CompetitionDetailPage />}
                  ></Route>
                  <Route path="/players" element={<PlayerListPage />}></Route>
                  <Route
                    path="/players/:playerId"
                    element={<PlayerDetailPage />}
                  ></Route>
                  <Route path="*" element={<NotFoundPage />}></Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </QueryClientProvider>
        </AuthProvider>
      </MantineProvider>
    </>
  );
}

export default App;
