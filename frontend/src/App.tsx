import { CompetitionList } from "./CompetitionList";
import Typography from "@mui/material/Typography";

function App() {
  return (
    <>
      <header>
        <Typography variant="h2" align="center">
          PetLom
        </Typography>
        <Typography variant="subtitle1" align="center">
          Manage Chess Competitions
        </Typography>
      </header>
      <main>
        <CompetitionList />
      </main>
    </>
  );
}

export default App;
