import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Anchor,
  Breadcrumbs,
  Button,
  Collapse,
  Group,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useCompetition } from "@/competitions/useCompetitions";
import { MatchList } from "@/matches/MatchTable";
import RankingTable from "@/competitions/RankingTable";
import RoundPlayerList from "@/competitions/RoundPlayerList";
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
  const [playersVisible, setPlayersVisible] = useState(false);

  if (isPending) return <Text>Loading...</Text>;
  if (isError || !competition) return <NotFoundPage />;

  const nRounds = competition.n_rounds;
  const nextRound = nRounds + 1;
  const currentRound = roundNr ?? nRounds;
  const isDraftRound = currentRound > nRounds;
  const backUrl = `/competitions/${name}`;
  const nextRoundUrl = `/competitions/${name}/round/${nextRound}`;

  if (isDraftRound && !isModerator) return <NotFoundPage />;

  if (isDraftRound) {
    return (
      <Stack>
        <CompetitionBreadcrumbs name={name} currentRound={currentRound} nRounds={nRounds} />
        <RoundPlayerList
          competitionName={name}
          roundNr={currentRound}
          onPairingCreated={() => navigate(backUrl)}
          onDraftCleared={() => navigate(backUrl)}
        />
      </Stack>
    );
  }

  if (currentRound === 0) {
    return (
      <Stack>
        <CompetitionBreadcrumbs name={name} currentRound={0} nRounds={0} />
        <Text>No rounds yet.</Text>
        {isModerator && (
          <Button onClick={() => navigate(nextRoundUrl)}>
            Create pairing for round 1
          </Button>
        )}
      </Stack>
    );
  }

  const isLatestRound = currentRound === nRounds;

  const handleRoundChange = (roundValue: number) => {
    navigate(roundValue === nRounds
      ? backUrl
      : `/competitions/${name}/round/${roundValue}`
    );
  };

  const roundOptions = Array.from({ length: nRounds }, (_, i) => ({
    value: String(i + 1),
    label: `Round ${i + 1}`,
  }));

  return (
    <Stack>
      <CompetitionBreadcrumbs name={name} currentRound={currentRound} nRounds={nRounds} />

      <Group>
        <Select
          value={String(currentRound)}
          onChange={(val) => val && handleRoundChange(Number(val))}
          data={roundOptions}
        />
        {isModerator && isLatestRound ? (
          <Button onClick={() => navigate(nextRoundUrl)}>
            Create pairing for round {nextRound}
          </Button>
        ) : (
          <Button variant="default" onClick={() => setPlayersVisible((v) => !v)}>
            {playersVisible ? "Hide players" : "Show players"}
          </Button>
        )}
      </Group>

      <Collapse expanded={playersVisible}>
        <RoundPlayerList competitionName={name} roundNr={currentRound} readOnly />
      </Collapse>
      <MatchList competition_name={name} round={currentRound} />
      <RankingTable competitionName={name} roundNr={currentRound} />
    </Stack>
  );
}

function CompetitionBreadcrumbs({
  name,
  currentRound,
  nRounds,
}: {
  name: string;
  currentRound: number;
  nRounds: number;
}) {
  const nameIsLink = currentRound !== nRounds;
  return (
    <Breadcrumbs>
      <Anchor href="/competitions">Competitions</Anchor>
      {nameIsLink
        ? <Anchor href={`/competitions/${name}`}>{name}</Anchor>
        : <Text>{name}</Text>}
      {nameIsLink && <Text>Round {currentRound}</Text>}
    </Breadcrumbs>
  );
}
