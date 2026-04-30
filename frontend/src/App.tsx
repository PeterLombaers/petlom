import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { theme } from "./theme";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  HomePage,
  CompetitionListPage,
  CompetitionDetailPage,
  PlayerListPage,
  PlayerDetailPage,
  LoginPage,
  NotFoundPage,
} from "./pages";
import Layout from "./Layout";
import { AuthProvider } from "./auth";

const queryClient = new QueryClient();

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
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<Layout />}>
                  <Route index element={<HomePage />}></Route>
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
