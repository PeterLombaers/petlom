import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Collapse,
  Group,
  Modal,
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
import PlayerRatingTable from "@/competitions/PlayerRatingTable";
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
  const {
    data: competition,
    isPending,
    isError,
    finishMutation,
  } = useCompetition(name);
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
  const isFinished = competition.is_finished;
  const currentRound = roundNr ?? nRounds;
  const isDraftRound = currentRound > nRounds;
  const backUrl = `/competitions/${name}`;

  // A finished competition accepts no new pairing, so a stale draft-round URL
  // must not reach the RegistrationEditor.
  if (isDraftRound && (!isModerator || isFinished)) return <NotFoundPage />;

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
    body = <NoRoundsYet name={name} isFinished={isFinished} />;
  } else {
    body = (
      <RoundView
        name={name}
        currentRound={currentRound}
        nRounds={nRounds}
        isFinished={isFinished}
      />
    );
  }

  return (
    <Stack>
      <h1 className="sr-only">{pageTitle}</h1>
      <Group justify="space-between">
        <Group>
          <CompetitionBreadcrumbs
            name={name}
            currentRound={currentRound}
            nRounds={nRounds}
          />
          {isFinished && (
            <Badge color="gray">{t("competition.finished")}</Badge>
          )}
        </Group>
        {isModerator && (
          <FinishButton
            name={name}
            isFinished={isFinished}
            finishMutation={finishMutation}
          />
        )}
      </Group>
      {body}
    </Stack>
  );
}

function FinishButton({
  name,
  isFinished,
  finishMutation,
}: {
  name: string;
  isFinished: boolean;
  finishMutation: ReturnType<typeof useCompetition>["finishMutation"];
}) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const confirm = () => {
    finishMutation.mutate(
      {
        params: { path: { name } },
        body: { is_finished: !isFinished },
      },
      { onSuccess: () => setConfirmOpen(false) },
    );
  };

  return (
    <>
      <Button variant="default" onClick={() => setConfirmOpen(true)}>
        {isFinished ? t("competition.reopen") : t("competition.finish")}
      </Button>
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={
          isFinished
            ? t("competition.confirmReopenTitle")
            : t("competition.confirmFinishTitle")
        }
      >
        <Stack>
          <Text>
            {isFinished
              ? t("competition.confirmReopenBody", { name })
              : t("competition.confirmFinishBody", { name })}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirm} loading={finishMutation.isPending}>
              {isFinished ? t("competition.reopen") : t("competition.finish")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function NoRoundsYet({
  name,
  isFinished,
}: {
  name: string;
  isFinished: boolean;
}) {
  const navigate = useNavigate();
  const { isModerator } = useAuth();
  const { t } = useTranslation();
  return (
    <>
      <Text>{t("competition.noRoundsYet")}</Text>
      {isModerator && !isFinished && (
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
  isFinished,
}: {
  name: string;
  currentRound: number;
  nRounds: number;
  isFinished: boolean;
}) {
  const navigate = useNavigate();
  const { isModerator } = useAuth();
  const { t } = useTranslation();
  const [playersVisible, setPlayersVisible] = useState(false);
  const [ratingsVisible, setRatingsVisible] = useState(false);

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
        <Button onClick={() => setPlayersVisible((v) => !v)}>
          {playersVisible
            ? t("competition.hidePlayers")
            : t("competition.showPlayers")}
        </Button>
        <Button onClick={() => setRatingsVisible((v) => !v)}>
          {ratingsVisible
            ? t("competition.hideRatings")
            : t("competition.showRatings")}
        </Button>
        {isModerator && !isFinished && isLatestRound && (
          <Button
            onClick={() => navigate(`/competitions/${name}/round/${nextRound}`)}
          >
            {t("competition.createPairingRoundN", { nextRound })}
          </Button>
        )}
      </Group>

      <Collapse expanded={playersVisible}>
        <RegisteredPlayerTable competitionName={name} roundNr={currentRound} />
      </Collapse>
      <Collapse expanded={ratingsVisible}>
        <PlayerRatingTable competitionName={name} readOnly={isFinished} />
      </Collapse>
      <MatchTable
        competitionName={name}
        round={currentRound}
        readOnly={isFinished}
      />
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
