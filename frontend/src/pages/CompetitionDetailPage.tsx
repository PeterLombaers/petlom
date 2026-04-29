import { useNavigate, useParams } from "react-router-dom";
import {
  Anchor,
  Breadcrumbs,
  Button,
  Group,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useCompetition } from "@/competitions/useCompetitions";
import { MatchList } from "@/matches/MatchTable";
import RankingTable from "@/competitions/RankingTable";
import RoundPlayerList from "@/competitions/RoundPlayerList";
import {
  useRoundPlayers,
  useCreateRoundPlayers,
} from "@/competitions/useRoundPlayers";
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

  const nRounds = competition?.n_rounds ?? 0;
  const nextRound = nRounds + 1;
  const { roundPlayers: draftPlayers } = useRoundPlayers(name, nextRound);

  if (isPending) return <Text>Loading...</Text>;
  if (isError || !competition) return <NotFoundPage />;

  const currentRound = roundNr ?? nRounds;
  const isLatestRound = currentRound === nRounds;
  const hasDraft =
    (draftPlayers && draftPlayers.length > 0) ||
    createRoundPlayersMutation.isSuccess;

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
      <Stack>
        <Breadcrumbs>
          <Anchor href="/competitions">Competitions</Anchor>
          <Text>{name}</Text>
        </Breadcrumbs>
        {isModerator && hasDraft ? (
          <RoundPlayerList
            competitionName={name}
            roundNr={nextRound}
            onPairingCreated={handlePairingCreated}
          />
        ) : (
          <>
            <Text>No rounds yet.</Text>
            {isModerator && (
              <Button onClick={handleCreateDraft}>
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

  const roundOptions = Array.from({ length: nRounds }, (_, i) => ({
    value: String(i + 1),
    label: `Round ${i + 1}`,
  }));

  return (
    <Stack>
      <Breadcrumbs>
        <Anchor href="/competitions">Competitions</Anchor>
        {isLatestRound ? (
          <Text>{name}</Text>
        ) : (
          <Anchor href={`/competitions/${name}`}>{name}</Anchor>
        )}
        {!isLatestRound && <Text>Round {currentRound}</Text>}
      </Breadcrumbs>

      <Group>
        <Select
          label="Round"
          value={String(currentRound)}
          onChange={(val) => val && handleRoundChange(Number(val))}
          data={roundOptions}
        />

        {isModerator && isLatestRound && !hasDraft && (
          <Button onClick={handleCreateDraft}>
            Create pairing for round {nextRound}
          </Button>
        )}
      </Group>

      {isModerator && isLatestRound && hasDraft && (
        <RoundPlayerList
          competitionName={name}
          roundNr={nextRound}
          onPairingCreated={handlePairingCreated}
        />
      )}

      <MatchList competition_name={name} round={currentRound} />

      <Title order={5}>Rankings after round {currentRound}</Title>
      <RankingTable competitionName={name} roundNr={currentRound} />
    </Stack>
  );
}
