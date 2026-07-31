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
import { useTranslation } from "react-i18next";
import { useCompetition } from "@/competitions/useCompetitions";
import { MatchTable } from "@/matches/MatchTable";
import RankingTable from "@/competitions/RankingTable";
import RegistrationEditor from "@/competitions/RegistrationEditor";
import RegisteredPlayerTable from "@/competitions/RegisteredPlayerTable";
import NotFoundPage from "./NotFoundPage";
import { useAuth } from "@/auth";
import { useDocumentTitle } from "@/pages/useDocumentTitle";

export default function CompetitionDetailPage() {
  const { name, round } = useParams();
  if (!name) return <NotFoundPage />;

  const roundNr = round ? Number(round) : undefined;
  if (roundNr !== undefined && (!Number.isInteger(roundNr) || roundNr < 1)) {
    return <NotFoundPage />;
  }

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
  const { t } = useTranslation();
  const pageTitle = roundNr
    ? t("pageTitle.competitionRound", { name, round: roundNr })
    : t("pageTitle.competitionDetail", { name });
  useDocumentTitle(pageTitle);

  if (isPending) return <Text>{t("common.loading")}</Text>;
  if (isError || !competition) return <NotFoundPage />;

  const nRounds = competition.n_rounds;
  const currentRound = roundNr ?? nRounds;
  const isDraftRound = currentRound > nRounds;
  const backUrl = `/competitions/${name}`;

  if (isDraftRound && !isModerator) return <NotFoundPage />;

  let body;
  if (isDraftRound) {
    body = (
      <RegistrationEditor
        competitionName={name}
        roundNr={currentRound}
        ratingType={competition.rating_type}
        onPairingCreated={() => navigate(backUrl)}
        onDraftCleared={() => navigate(backUrl)}
      />
    );
  } else if (currentRound === 0) {
    body = <NoRoundsYet name={name} />;
  } else {
    body = (
      <RoundView name={name} currentRound={currentRound} nRounds={nRounds} />
    );
  }

  return (
    <Stack>
      <h1 className="sr-only">{pageTitle}</h1>
      <CompetitionBreadcrumbs
        name={name}
        currentRound={currentRound}
        nRounds={nRounds}
      />
      {body}
    </Stack>
  );
}

function NoRoundsYet({ name }: { name: string }) {
  const navigate = useNavigate();
  const { isModerator } = useAuth();
  const { t } = useTranslation();
  return (
    <>
      <Text>{t("competition.noRoundsYet")}</Text>
      {isModerator && (
        <Button onClick={() => navigate(`/competitions/${name}/round/1`)}>
          {t("competition.createPairingRound1")}
        </Button>
      )}
    </>
  );
}

function RoundView({
  name,
  currentRound,
  nRounds,
}: {
  name: string;
  currentRound: number;
  nRounds: number;
}) {
  const navigate = useNavigate();
  const { isModerator } = useAuth();
  const { t } = useTranslation();
  const [playersVisible, setPlayersVisible] = useState(false);

  const nextRound = nRounds + 1;
  const backUrl = `/competitions/${name}`;
  const isLatestRound = currentRound === nRounds;

  const handleRoundChange = (roundValue: number) => {
    navigate(
      roundValue === nRounds
        ? backUrl
        : `/competitions/${name}/round/${roundValue}`,
    );
  };

  const roundOptions = Array.from({ length: nRounds }, (_, i) => ({
    value: String(i + 1),
    label: t("competition.roundLabel", { currentRound: i + 1 }),
  }));

  return (
    <>
      <Group>
        <Select
          value={String(currentRound)}
          onChange={(val) => val && handleRoundChange(Number(val))}
          data={roundOptions}
        />
        {isModerator && isLatestRound ? (
          <Button
            onClick={() => navigate(`/competitions/${name}/round/${nextRound}`)}
          >
            {t("competition.createPairingRoundN", { nextRound })}
          </Button>
        ) : (
          <Button
            variant="default"
            onClick={() => setPlayersVisible((v) => !v)}
          >
            {playersVisible
              ? t("competition.hidePlayers")
              : t("competition.showPlayers")}
          </Button>
        )}
      </Group>

      <Collapse expanded={playersVisible}>
        <RegisteredPlayerTable competitionName={name} roundNr={currentRound} />
      </Collapse>
      <MatchTable competitionName={name} round={currentRound} />
      <RankingTable competitionName={name} roundNr={currentRound} />
    </>
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
  const { t } = useTranslation();
  const nameIsLink = currentRound !== nRounds;
  return (
    <Breadcrumbs>
      <Anchor href="/competitions">{t("nav.competitions")}</Anchor>
      {nameIsLink ? (
        <Anchor href={`/competitions/${name}`}>{name}</Anchor>
      ) : (
        <Text>{name}</Text>
      )}
      {nameIsLink && (
        <Text>{t("competition.roundLabel", { currentRound })}</Text>
      )}
    </Breadcrumbs>
  );
}
