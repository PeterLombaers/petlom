import { useNavigate, useParams } from "react-router-dom";
import {
  Breadcrumbs,
  Button,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCompetition } from "@/competitions/useCompetitions";
import { MatchList } from "@/matches/MatchTable";
import RankingTable from "@/competitions/RankingTable";
import NotFoundPage from "./NotFoundPage";

export default function CompetitionDetailPage() {
  const { name, round } = useParams();
  if (!name) return <NotFoundPage />;

  const roundNr = round ? parseInt(round) : undefined;
  if (round && !roundNr) return <NotFoundPage />;

  return <CompetitionDetail name={name} roundNr={roundNr} />;
}

function CompetitionDetail({
  name,
  roundNr,
}: {
  name: string;
  roundNr?: number;
}) {
  const { data: competition, isPending, isError } = useCompetition(name);

  if (isPending) return <Typography>Loading...</Typography>;
  if (isError || !competition) return <NotFoundPage />;

  const nRounds = competition.n_rounds;
  const currentRound = roundNr ?? nRounds;
  const isLatestRound = currentRound === nRounds;

  if (currentRound === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5">{name}</Typography>
        <Typography>No rounds yet.</Typography>
        <Button variant="contained" disabled>
          Create pairing for round 1
        </Button>
      </Stack>
    );
  }

  const navigate = useNavigate();

  const handleRoundChange = (roundValue: number) => {
    if (roundValue === nRounds) {
      navigate(`/competitions/${name}`);
    } else {
      navigate(`/competitions/${name}/round/${roundValue}`);
    }
  };

  return (
    <Stack spacing={2}>
      <Breadcrumbs>
        <Link href="/competitions">Competitions</Link>
        {isLatestRound ? (
          <Typography>{name}</Typography>
        ) : (
          <Link href={`/competitions/${name}`}>{name}</Link>
        )}
        {!isLatestRound && <Typography>Round {currentRound}</Typography>}
      </Breadcrumbs>

      <Stack direction="row" spacing={1}>
        <TextField
          select
          label="Round"
          value={currentRound}
          onChange={(e) => handleRoundChange(Number(e.target.value))}
          size="small"
          sx={{ width: 120 }}
        >
          {Array.from({ length: nRounds }, (_, i) => i + 1).map((r) => (
            <MenuItem key={r} value={r}>
              Round {r}
            </MenuItem>
          ))}
        </TextField>

        {isLatestRound && (
          <Button variant="contained" disabled>
            Create pairing for round {nRounds + 1}
          </Button>
        )}
      </Stack>

      <MatchList competition_name={name} round={currentRound} />

      <Typography variant="h6">Rankings after round {currentRound}</Typography>
      <RankingTable competitionName={name} roundNr={currentRound} />
    </Stack>
  );
}
