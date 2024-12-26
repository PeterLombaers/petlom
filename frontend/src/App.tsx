import { Competition, CompetitionProps } from "./Competition";

const competitions: CompetitionProps[] = [
  {
    name: "interne_2024",
    type: "simkro",
    created_at: new Date("2024-12-21T13:44:57.875553"),
    updated_at: new Date("2024-12-21T13:44:57.875670"),
  },
];

function App() {
  return (
    <body>
      <header>
        <h2>PetLom</h2>
        <h4>Manage Chess Competitions</h4>
      </header>
      <main>
        {competitions.map((competition) => {
          return <Competition {...competition} />;
        })}
      </main>
    </body>
  );
}

export default App;
