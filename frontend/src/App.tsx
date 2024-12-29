import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./utils";
import { CssBaseline } from "@mui/material";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage, CompetitionsPage } from "./pages";
import Layout from "./Layout";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />}></Route>
            <Route path="competitions" element={<CompetitionsPage />}></Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
