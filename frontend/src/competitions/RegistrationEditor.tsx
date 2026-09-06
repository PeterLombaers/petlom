import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  MultiSelect,
  Radio,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { $api, formatHTTPValidationError } from "@client/api";
import { components } from "@/client/schema";
import { LoadingState } from "@/ui/LoadingState";
import { ErrorState } from "@/ui/ErrorState";
import { PlayerName } from "@/ui/PlayerName";
import { getRating } from "@/players/external";
import NewPlayerButton from "@/players/NewPlayerButton";
import { useRegistrations } from "./useRegistrations";
import ImportRegistrationsModal from "./ImportRegistrationsModal";
import SeedRatingsModal, { PlayerNeedingRating } from "./SeedRatingsModal";
import { useState } from "react";

type CompetitionRatingTypePublic =
  components["schemas"]["CompetitionRatingTypePublic"];

export default function RegistrationEditor({
  competitionName,
  roundNr,
  ratingType,
  onPairingCreated,
  onDraftCleared,
}: {
  competitionName: string;
  roundNr: number;
  ratingType: CompetitionRatingTypePublic;
  onPairingCreated?: () => void;
  onDraftCleared?: () => void;
}) {
  const { t } = useTranslation();
  const {
    registrations,
    error,
    isPending,
    isError,
    updateMutation,
    deleteMutation,
    createPairingMutation,
  } = useRegistrations(competitionName, roundNr);

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [clearModalOpened, { open: openClearModal, close: closeClearModal }] =
    useDisclosure(false);
  const [
    importModalOpened,
    { open: openImportModal, close: closeImportModal },
  ] = useDisclosure(false);
  const [playersNeedingRatings, setPlayersNeedingRatings] = useState<
    PlayerNeedingRating[]
  >([]);

  const { data: allPlayers } = $api.useQuery("get", "/players/");

  const { data: existingRatings } = $api.useQuery(
    "get",
    "/competitions/{name}/player-ratings",
    { params: { path: { name: competitionName } } },
  );

  if (isPending) return <LoadingState />;
  if (isError || !registrations)
    return <ErrorState message={formatHTTPValidationError(error)} />;

  const playerCount = registrations.length;
  const isOdd = playerCount % 2 !== 0;
  const byePlayer = registrations.find((rp) => rp.is_bye);

  const canGenerate = playerCount >= 2 && (!isOdd || byePlayer);
  const enrolledPlayerIds = new Set(registrations.map((rp) => rp.player.id));
  const playerOptions = (allPlayers ?? [])
    .filter((p) => !enrolledPlayerIds.has(p.id))
    .map((p) => ({
      value: String(p.id),
      label: `${p.name} (${getRating(p, "fide")?.rating ?? "—"})`,
    }));

  const ratedPlayerIds = new Set(
    (existingRatings ?? []).map((r) => r.player_id),
  );

  const roundParams = {
    params: { path: { name: competitionName }, query: { round_nr: roundNr } },
  };

  const doAddPlayers = (initialRatings?: Record<number, number>) => {
    updateMutation.mutate(
      {
        ...roundParams,
        body: {
          player_ids_to_add: selectedPlayerIds.map(Number),
          initial_ratings: initialRatings ?? null,
        },
      },
      {
        onSuccess: () => {
          setSelectedPlayerIds([]);
          setPlayersNeedingRatings([]);
        },
      },
    );
  };

  const handleAddPlayers = () => {
    if (!selectedPlayerIds.length) return;

    if (
      ratingType.default_initial_rating != null ||
      selectedPlayerIds.every((id) => ratedPlayerIds.has(Number(id)))
    ) {
      doAddPlayers();
      return;
    }

    const unrated = selectedPlayerIds
      .map((id) => {
        const num = Number(id);
        if (ratedPlayerIds.has(num)) return null;
        return (allPlayers ?? []).find((p) => p.id === num) ?? null;
      })
      .filter((p): p is PlayerNeedingRating => p != null);

    if (unrated.length === 0) {
      doAddPlayers();
      return;
    }

    setPlayersNeedingRatings(unrated);
  };

  const handleRemovePlayer = (playerId: number) => {
    updateMutation.mutate({
      ...roundParams,
      body: { player_ids_to_remove: [playerId] },
    });
  };

  const handleSetBye = (playerId: number) => {
    updateMutation.mutate({
      ...roundParams,
      body: { bye_player_id: playerId },
    });
  };

  const handleClearBye = () => {
    updateMutation.mutate({ ...roundParams, body: { clear_bye: true } });
  };

  const handleGeneratePairing = () => {
    createPairingMutation.mutate(
      {
        params: { path: { name: competitionName } },
        body: { round_nr: roundNr },
      },
      { onSuccess: onPairingCreated },
    );
  };

  const handleConfirmClearAll = () => {
    deleteMutation.mutate(
      {
        params: {
          path: { name: competitionName },
          query: { round_nr: roundNr },
        },
      },
      {
        onSuccess: () => {
          closeClearModal();
          onDraftCleared?.();
        },
      },
    );
  };

  const colSpan = 3 + (isOdd ? 1 : 0);

  return (
    <Stack>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("registration.player")}</Table.Th>
            <Table.Th>{t("rating.ratingHeader")}</Table.Th>
            {isOdd && <Table.Th>{t("registration.bye")}</Table.Th>}
            <Table.Th>{t("common.actions")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {registrations.map((rp) => (
            <Table.Tr key={rp.id}>
              <Table.Td>
                <PlayerName
                  name={rp.player.name}
                  isActive={rp.player.is_active}
                />
              </Table.Td>
              <Table.Td>
                {rp.rating != null ? Math.round(rp.rating) : "—"}
              </Table.Td>
              {isOdd && (
                <Table.Td>
                  <Radio
                    checked={rp.is_bye}
                    onChange={() =>
                      rp.is_bye ? handleClearBye() : handleSetBye(rp.player.id)
                    }
                  />
                </Table.Td>
              )}
              <Table.Td>
                <ActionIcon onClick={() => handleRemovePlayer(rp.player.id)}>
                  <IconTrash size={18} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr>
            <Table.Td colSpan={colSpan}>
              <div
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !comboboxOpen &&
                    selectedPlayerIds.length
                  ) {
                    handleAddPlayers();
                  }
                }}
              >
                <Group>
                  <MultiSelect
                    data={playerOptions}
                    value={selectedPlayerIds}
                    onChange={setSelectedPlayerIds}
                    onDropdownOpen={() => setComboboxOpen(true)}
                    onDropdownClose={() => setComboboxOpen(false)}
                    searchable
                    clearable
                    placeholder={t("registration.selectPlayers")}
                    comboboxProps={{
                      width: "max-content",
                      position: "bottom-start",
                    }}
                  />
                  <Button
                    onClick={handleAddPlayers}
                    disabled={
                      !selectedPlayerIds.length || updateMutation.isPending
                    }
                  >
                    {t("registration.add")}
                  </Button>
                  <NewPlayerButton
                    onCreated={(player) =>
                      setSelectedPlayerIds((prev) => [
                        ...prev,
                        String(player.id),
                      ])
                    }
                  />
                  <Button onClick={openImportModal}>
                    {t("registration.importFromWebsite")}
                  </Button>
                </Group>
              </div>
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>

      {isOdd && !byePlayer && (
        <Alert>{t("registration.oddPlayersWarning")}</Alert>
      )}

      <Group>
        <Button
          onClick={handleGeneratePairing}
          disabled={!canGenerate || createPairingMutation.isPending}
        >
          {createPairingMutation.isPending
            ? t("registration.generating")
            : t("registration.generatePairing", { roundNr })}
        </Button>
        <Button variant="default" onClick={openClearModal}>
          {t("registration.clearAll")}
        </Button>
      </Group>

      <Modal
        opened={clearModalOpened}
        onClose={closeClearModal}
        title={t("registration.clearAllPlayers")}
      >
        <Text>{t("registration.confirmClearAll")}</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={closeClearModal}>
            {t("common.cancel")}
          </Button>
          <Button
            color="red"
            onClick={handleConfirmClearAll}
            loading={deleteMutation.isPending}
          >
            {t("registration.clearAll")}
          </Button>
        </Group>
      </Modal>

      {importModalOpened && (
        <ImportRegistrationsModal
          competitionName={competitionName}
          roundNr={roundNr}
          enrolledPlayerIds={enrolledPlayerIds}
          onClose={closeImportModal}
          onImport={(playerIds) =>
            setSelectedPlayerIds((prev) => [
              ...new Set([...prev, ...playerIds.map(String)]),
            ])
          }
        />
      )}

      {playersNeedingRatings.length > 0 && (
        <SeedRatingsModal
          players={playersNeedingRatings}
          competitionName={competitionName}
          onClose={() => setPlayersNeedingRatings([])}
          onConfirm={doAddPlayers}
          isPending={updateMutation.isPending}
        />
      )}
    </Stack>
  );
}
