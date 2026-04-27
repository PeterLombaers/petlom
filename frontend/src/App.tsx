import * as React from "react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { CssBaseline } from "@mui/material";
import {
  BrowserRouter,
  Routes,
  Route,
  Link as RouterLink,
  LinkProps as RouterLinkProps,
} from "react-router-dom";
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
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LinkProps } from "@mui/material/Link";

const LinkBehavior = React.forwardRef<
  HTMLAnchorElement,
  Omit<RouterLinkProps, "to"> & { href: RouterLinkProps["to"] }
>((props, ref) => {
  const { href, ...other } = props;
  // Map href (MUI) -> to (react-router)
  return (
    <RouterLink data-testid="custom-link" ref={ref} to={href} {...other} />
  );
});

const theme = createTheme({
  components: {
    MuiLink: {
      defaultProps: {
        component: LinkBehavior,
      } as LinkProps,
    },
    MuiButtonBase: {
      defaultProps: {
        LinkComponent: LinkBehavior,
      },
    },
  },
});

const queryClient = new QueryClient();

// This code is only for TypeScript
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__: import("@tanstack/query-core").QueryClient;
  }
}

// This code is for all users
window.__TANSTACK_QUERY_CLIENT__ = queryClient;

function App() {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <CssBaseline />
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
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
