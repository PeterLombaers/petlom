import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Radio,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { $api } from "@client/api";
import { components } from "@/client/schema";
import { useRoundPlayers } from "./useRoundPlayers";
import { useState } from "react";

type RoundPlayerPublic = components["schemas"]["RoundPlayerPublic"];
type CompetitionRatingTypePublic =
  components["schemas"]["CompetitionRatingTypePublic"];

export default function RoundPlayerList({
  competitionName,
  roundNr,
  readOnly = false,
  ratingType,
  onPairingCreated,
  onDraftCleared,
}: {
  competitionName: string;
  roundNr: number;
  readOnly?: boolean;
  ratingType: CompetitionRatingTypePublic;
  onPairingCreated?: () => void;
  onDraftCleared?: () => void;
}) {
  const { t } = useTranslation();
  const {
    roundPlayers,
    isPending,
    isError,
    updateMutation,
    deleteMutation,
    createPairingMutation,
  } = useRoundPlayers(competitionName, roundNr);

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [clearModalOpened, { open: openClearModal, close: closeClearModal }] =
    useDisclosure(false);
  const [ratingsModalOpened, { open: openRatingsModal, close: closeRatingsModal }] =
    useDisclosure(false);
  const [pendingRatings, setPendingRatings] = useState<Record<number, number | string>>({});
  const [playersNeedingRatings, setPlayersNeedingRatings] = useState<
    { id: number; name: string }[]
  >([]);

  const { data: allPlayers } = $api.useQuery("get", "/players/", undefined, {
    enabled: !readOnly,
  });

  const { data: existingRatings } = $api.useQuery(
    "get",
    "/competitions/{name}/player-ratings",
    { params: { path: { name: competitionName } } },
    { enabled: !readOnly },
  );

  if (isPending) return <Text>{t("roundPlayers.loadingList")}</Text>;
  if (isError || !roundPlayers)
    return <Text>{t("roundPlayers.errorLoading")}</Text>;

  const playerCount = roundPlayers.length;
  const isOdd = playerCount % 2 !== 0;
  const byePlayer = roundPlayers.find((rp: RoundPlayerPublic) => rp.is_bye);
  const hasBye = roundPlayers.some((rp: RoundPlayerPublic) => rp.is_bye);

  if (readOnly) {
    return (
      <Stack>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("roundPlayers.player")}</Table.Th>
              <Table.Th>{t("rating.ratingHeader")}</Table.Th>
              {hasBye && <Table.Th>{t("roundPlayers.bye")}</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {roundPlayers.map((rp: RoundPlayerPublic) => (
              <Table.Tr key={rp.id}>
                <Table.Td>{rp.player.name}</Table.Td>
                <Table.Td>
                  {rp.initial_rating != null ? Math.round(rp.initial_rating) : "—"}
                </Table.Td>
                {hasBye && (
                  <Table.Td>{rp.is_bye && <IconCheck size={16} />}</Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    );
  }

  const canGenerate = playerCount >= 2 && (!isOdd || byePlayer);
  const enrolledPlayerIds = new Set(
    roundPlayers.map((rp: RoundPlayerPublic) => rp.player.id),
  );
  const playerOptions = (allPlayers ?? [])
    .filter((p) => !enrolledPlayerIds.has(p.id))
    .map((p) => ({ value: String(p.id), label: p.name }));

  const ratedPlayerIds = new Set((existingRatings ?? []).map((r) => r.player_id));

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
          closeRatingsModal();
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
        const player = (allPlayers ?? []).find((p) => p.id === num);
        return player ? { id: num, name: player.name } : null;
      })
      .filter((p): p is { id: number; name: string } => p != null);

    if (unrated.length === 0) {
      doAddPlayers();
      return;
    }

    setPlayersNeedingRatings(unrated);
    setPendingRatings(Object.fromEntries(unrated.map((p) => [p.id, ""])));
    openRatingsModal();
  };

  const handleConfirmRatings = () => {
    const initialRatings: Record<number, number> = {};
    for (const p of playersNeedingRatings) {
      const val = pendingRatings[p.id];
      if (val === "" || val == null) return;
      initialRatings[p.id] = Number(val);
    }
    doAddPlayers(initialRatings);
  };

  const allRatingsFilled = playersNeedingRatings.every(
    (p) => pendingRatings[p.id] !== "" && pendingRatings[p.id] != null,
  );

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
    const playerIds = roundPlayers
      .filter((rp: RoundPlayerPublic) => !rp.is_bye)
      .map((rp: RoundPlayerPublic) => rp.player.id);
    createPairingMutation.mutate(
      {
        params: { path: { name: competitionName } },
        body: { round_nr: roundNr, player_ids: playerIds },
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
            <Table.Th>{t("roundPlayers.player")}</Table.Th>
            <Table.Th>{t("rating.ratingHeader")}</Table.Th>
            {isOdd && <Table.Th>{t("roundPlayers.bye")}</Table.Th>}
            <Table.Th>{t("common.actions")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {roundPlayers.map((rp: RoundPlayerPublic) => (
            <Table.Tr key={rp.id}>
              <Table.Td>{rp.player.name}</Table.Td>
              <Table.Td>
                {rp.initial_rating != null ? Math.round(rp.initial_rating) : "—"}
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
                    placeholder={t("roundPlayers.selectPlayers")}
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
                    {t("roundPlayers.add")}
                  </Button>
                </Group>
              </div>
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>

      {isOdd && !byePlayer && (
        <Alert>{t("roundPlayers.oddPlayersWarning")}</Alert>
      )}

      <Group>
        <Button
          onClick={handleGeneratePairing}
          disabled={!canGenerate || createPairingMutation.isPending}
        >
          {createPairingMutation.isPending
            ? t("roundPlayers.generating")
            : t("roundPlayers.generatePairing", { roundNr })}
        </Button>
        <Button variant="default" onClick={openClearModal}>
          {t("roundPlayers.clearAll")}
        </Button>
      </Group>

      <Modal
        opened={clearModalOpened}
        onClose={closeClearModal}
        title={t("roundPlayers.clearAllPlayers")}
      >
        <Text>{t("roundPlayers.confirmClearAll")}</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={closeClearModal}>
            {t("common.cancel")}
          </Button>
          <Button
            color="red"
            onClick={handleConfirmClearAll}
            loading={deleteMutation.isPending}
          >
            {t("roundPlayers.clearAll")}
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={ratingsModalOpened}
        onClose={closeRatingsModal}
        title={t("rating.setRatingsTitle")}
      >
        <Stack>
          <Text size="sm">{t("rating.setRatingsDescription")}</Text>
          {playersNeedingRatings.map((p) => (
            <NumberInput
              key={p.id}
              label={t("rating.initialRatingLabel", { playerName: p.name })}
              value={pendingRatings[p.id]}
              onChange={(v) =>
                setPendingRatings((prev) => ({ ...prev, [p.id]: v }))
              }
              min={0}
              allowDecimal={false}
              required
            />
          ))}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeRatingsModal}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleConfirmRatings}
              disabled={!allRatingsFilled || updateMutation.isPending}
              loading={updateMutation.isPending}
            >
              {t("rating.confirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
