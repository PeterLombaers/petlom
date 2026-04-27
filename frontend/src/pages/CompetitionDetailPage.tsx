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
import RoundPlayerList from "@/competitions/RoundPlayerList";
import { useRoundPlayers, useCreateRoundPlayers } from "@/competitions/useRoundPlayers";
import NotFoundPage from "./NotFoundPage";
import { useAuth } from "@/auth";

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
  const navigate = useNavigate();
  const { isModerator } = useAuth();
  const createRoundPlayersMutation = useCreateRoundPlayers();

  // Always query for next round's draft players.
  // nRounds isn't available until competition loads, so we use 0 as fallback
  // and the query will just return empty.
  const nRounds = competition?.n_rounds ?? 0;
  const nextRound = nRounds + 1;
  const { roundPlayers: draftPlayers } = useRoundPlayers(name, nextRound);

  if (isPending) return <Typography>Loading...</Typography>;
  if (isError || !competition) return <NotFoundPage />;

  const currentRound = roundNr ?? nRounds;
  const isLatestRound = currentRound === nRounds;
  const hasDraft = (draftPlayers && draftPlayers.length > 0) || createRoundPlayersMutation.isSuccess;

  const handleCreateDraft = () => {
    createRoundPlayersMutation.mutate({
      params: {
        path: { name },
        query: { round_nr: nextRound },
      },
    });
  };

  const handlePairingCreated = () => {
    createRoundPlayersMutation.reset();
    navigate(`/competitions/${name}`);
  };

  if (currentRound === 0) {
    return (
      <Stack spacing={2}>
        <Breadcrumbs>
          <Link href="/competitions">Competitions</Link>
          <Typography>{name}</Typography>
        </Breadcrumbs>
        {isModerator && hasDraft ? (
          <RoundPlayerList
            competitionName={name}
            roundNr={nextRound}
            onPairingCreated={handlePairingCreated}
          />
        ) : (
          <>
            <Typography>No rounds yet.</Typography>
            {isModerator && (
              <Button variant="contained" onClick={handleCreateDraft}>
                Create pairing for round 1
              </Button>
            )}
          </>
        )}
      </Stack>
    );
  }

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

        {isModerator && isLatestRound && !hasDraft && (
          <Button variant="contained" onClick={handleCreateDraft}>
            Create pairing for round {nextRound}
          </Button>
        )}
      </Stack>

      {isModerator && isLatestRound && hasDraft && (
        <RoundPlayerList
          competitionName={name}
          roundNr={nextRound}
          onPairingCreated={handlePairingCreated}
        />
      )}

      <MatchList competition_name={name} round={currentRound} />

      <Typography variant="h6">Rankings after round {currentRound}</Typography>
      <RankingTable competitionName={name} roundNr={currentRound} />
    </Stack>
  );
}
