import { useState } from "react";
import {
  Anchor,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatHTTPValidationError } from "@/client/api";
import { components } from "@/client/schema";
import { useAuth } from "@/auth";
import { useDocumentTitle } from "@/pages/useDocumentTitle";
import { ErrorState } from "@/ui/ErrorState";
import { LoadingState } from "@/ui/LoadingState";
import { fideProfileUrl, getExternalId } from "./external";
import { useImportExternalRatings } from "./useImportExternalRatings";
import { usePlayer, usePlayers } from "./usePlayers";

type PlayerDetailData = components["schemas"]["PlayerDetail"];
type PlayerExternalIdPublic = components["schemas"]["PlayerExternalIdPublic"];
type CompetitionRatingForPlayer =
  components["schemas"]["CompetitionRatingForPlayer"];

/** How many competitions the detail page lists, most recent first. */
const MAX_COMPETITIONS = 5;

export default function PlayerDetail({ playerId }: { playerId: number }) {
  const { t } = useTranslation();
  const { data: player, isPending, isError, error } = usePlayer(playerId);

  useDocumentTitle(
    player && t("pageTitle.playerDetail", { name: player.name }),
  );

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={formatHTTPValidationError(error)} />;

  return (
    <Stack>
      <PlayerHeader player={player} />
      <ExternalRatingsSection player={player} />
      <CompetitionsSection ratings={player.competition_ratings} />
    </Stack>
  );
}

/** The player's name as the page heading, editable by moderators. */
function PlayerHeader({ player }: { player: PlayerDetailData }) {
  const { t } = useTranslation();
  const { isModerator } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Paper withBorder p="md">
      {isEditing ? (
        <PlayerForm player={player} onClose={() => setIsEditing(false)} />
      ) : (
        <Group justify="space-between">
          <Title order={1} size="h2">
            {player.name}
          </Title>
          {isModerator && (
            <Button variant="default" onClick={() => setIsEditing(true)}>
              {t("common.edit")}
            </Button>
          )}
        </Group>
      )}
    </Paper>
  );
}

/**
 * Name and FIDE id in one form.
 *
 * They live on different endpoints, so a save issues only the calls for the
 * fields that actually changed — clearing the FIDE id deletes the external id.
 */
function PlayerForm({
  player,
  onClose,
}: {
  player: PlayerDetailData;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { editMutation, setExternalIdMutation, deleteExternalIdMutation } =
    usePlayers();
  const initialFideId = getExternalId(player, "fide") ?? "";
  const [name, setName] = useState(player.name);
  const [fideId, setFideId] = useState(initialFideId);

  const isPending =
    editMutation.isPending ||
    setExternalIdMutation.isPending ||
    deleteExternalIdMutation.isPending;
  const trimmedName = name.trim();
  const trimmedFideId = fideId.trim();

  const handleSave = async () => {
    const id = player.id;
    if (trimmedName !== player.name) {
      await editMutation.mutateAsync({
        body: { name: trimmedName },
        params: { path: { id } },
      });
    }
    if (trimmedFideId !== initialFideId) {
      const path = { id, source: "fide" as const };
      if (trimmedFideId) {
        await setExternalIdMutation.mutateAsync({
          body: { external_id: trimmedFideId },
          params: { path },
        });
      } else {
        await deleteExternalIdMutation.mutateAsync({ params: { path } });
      }
    }
    onClose();
  };

  return (
    <Stack>
      <TextInput
        required
        name="player-name"
        id="player-name"
        label={t("common.name")}
        value={name}
        error={trimmedName ? undefined : t("common.valueRequired")}
        onChange={(e) => setName(e.target.value)}
      />
      <TextInput
        name="player-fide-id"
        id="player-fide-id"
        label={t("player.fideId")}
        value={fideId}
        onChange={(e) => setFideId(e.target.value)}
      />
      <Group>
        <Button
          disabled={!trimmedName}
          loading={isPending}
          onClick={() => void handleSave()}
        >
          {t("common.save")}
        </Button>
        <Button variant="default" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * One row per external id, showing the rating snapshot the response carried.
 *
 * The full history stays available through GET /players/{id}/external-ratings/.
 */
function ExternalRatingsSection({ player }: { player: PlayerDetailData }) {
  const { t } = useTranslation();
  const { isModerator } = useAuth();
  const importMutation = useImportExternalRatings();

  return (
    <Paper withBorder p="md">
      <Stack>
        <Group justify="space-between">
          <Title order={2} size="h4">
            {t("player.externalRatings")}
          </Title>
          {isModerator && (
            <Button
              loading={importMutation.isPending}
              onClick={() =>
                importMutation.mutate({
                  params: { path: { source: "fide" } },
                  body: { player_ids: [player.id], update_existing: true },
                })
              }
            >
              {t("player.refreshFideRating")}
            </Button>
          )}
        </Group>
        {player.external_ids.length === 0 ? (
          <Text>{t("player.noExternalIds")}</Text>
        ) : (
          <Table.ScrollContainer minWidth={400} type="native">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("player.source")}</Table.Th>
                  <Table.Th>{t("player.externalId")}</Table.Th>
                  <Table.Th>{t("ranking.rating")}</Table.Th>
                  <Table.Th>{t("player.listDate")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {player.external_ids.map((externalId) => (
                  <ExternalIdRow key={externalId.id} externalId={externalId} />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Paper>
  );
}

function ExternalIdRow({ externalId }: { externalId: PlayerExternalIdPublic }) {
  return (
    <Table.Tr>
      <Table.Td>{externalId.source.toUpperCase()}</Table.Td>
      <Table.Td>
        {externalId.source === "fide" ? (
          <Anchor
            href={fideProfileUrl(externalId.external_id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {externalId.external_id}
          </Anchor>
        ) : (
          externalId.external_id
        )}
      </Table.Td>
      <Table.Td>{externalId.rating?.rating ?? "—"}</Table.Td>
      <Table.Td>{externalId.rating?.list_date ?? "—"}</Table.Td>
    </Table.Tr>
  );
}

/**
 * The competitions the player has a rating in, most recent first.
 *
 * No rank column: rank only comes from POST /competitions/{name}/ranking, which
 * recomputes and persists ratings and must not fire from a read-only page.
 */
function CompetitionsSection({
  ratings,
}: {
  ratings: CompetitionRatingForPlayer[];
}) {
  const { t } = useTranslation();
  const recent = [...ratings]
    .sort((a, b) =>
      b.rating_type.created_at.localeCompare(a.rating_type.created_at),
    )
    .slice(0, MAX_COMPETITIONS);

  return (
    <Paper withBorder p="md">
      <Stack>
        <Title order={2} size="h4">
          {t("player.competitions")}
        </Title>
        {recent.length === 0 ? (
          <Text>{t("player.noCompetitions")}</Text>
        ) : (
          <Table.ScrollContainer minWidth={400} type="native">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("player.competition")}</Table.Th>
                  <Table.Th>{t("player.initialRating")}</Table.Th>
                  <Table.Th>{t("player.currentRating")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recent.map((rating) => (
                  <Table.Tr key={rating.id}>
                    <Table.Td>
                      <Anchor
                        component={Link}
                        to={`/competitions/${rating.rating_type.competition_name}`}
                      >
                        {rating.rating_type.competition_name}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{Math.round(rating.initial_rating)}</Table.Td>
                    <Table.Td>{Math.round(rating.current_rating)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Paper>
  );
}
