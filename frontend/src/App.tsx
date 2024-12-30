import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { CssBaseline } from "@mui/material";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  HomePage,
  CompetitionListPage,
  CompetitionDetailPage,
  CompetitionRoundPage,
  PlayerListPage,
  PlayerDetailPage,
  NotFoundPage,
} from "./pages";
import Layout from "./Layout";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
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
              element={<CompetitionRoundPage />}
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
  );
}

export default App;
