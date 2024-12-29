import { Typography } from "@mui/material";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <>
      <header>
        <Typography variant="h2" align="center">
          PetLom
        </Typography>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
