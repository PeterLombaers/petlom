import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
// Must come after the core styles: the notification styles build on them.
import "@mantine/notifications/styles.css";
import "./index.css";
import "./i18n/index";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
