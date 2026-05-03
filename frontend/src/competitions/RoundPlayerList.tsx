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
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconTrash } from "@tabler/icons-react";
import { $api } from "@client/api";
import { components } from "@/client/schema";
import { useRoundPlayers } from "./useRoundPlayers";
import { useState } from "react";

type RoundPlayerPublic = components["schemas"]["RoundPlayerPublic"];

export default function RoundPlayerList({
  competitionName,
  roundNr,
  readOnly = false,
  onPairingCreated,
  onDraftCleared,
}: {
  competitionName: string;
  roundNr: number;
  readOnly?: boolean;
  onPairingCreated?: () => void;
  onDraftCleared?: () => void;
}) {
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

  const { data: allPlayers } = $api.useQuery("get", "/players/", undefined, {
    enabled: !readOnly,
  });

  if (isPending) return <Text>Loading player list...</Text>;
  if (isError || !roundPlayers) return <Text>Error loading player list.</Text>;

  // Derived state shared by both modes.
  const playerCount = roundPlayers.length;
  const isOdd = playerCount % 2 !== 0;
  const byePlayer = roundPlayers.find((rp: RoundPlayerPublic) => rp.is_bye);
  const hasBye = roundPlayers.some((rp: RoundPlayerPublic) => rp.is_bye);

  if (readOnly) {
    return (
      <Stack>
        <Title order={3}>Players ({playerCount})</Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Player</Table.Th>
              {hasBye && <Table.Th>Bye</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {roundPlayers.map((rp: RoundPlayerPublic) => (
              <Table.Tr key={rp.id}>
                <Table.Td>{rp.player.name}</Table.Td>
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

  // Edit-mode derived state.
  const canGenerate = playerCount >= 2 && (!isOdd || byePlayer);
  const enrolledPlayerIds = new Set(
    roundPlayers.map((rp: RoundPlayerPublic) => rp.player.id),
  );
  const playerOptions = (allPlayers ?? [])
    .filter((p) => !enrolledPlayerIds.has(p.id))
    .map((p) => ({ value: String(p.id), label: p.name }));

  // Shared params for all updateMutation calls.
  const roundParams = {
    params: { path: { name: competitionName }, query: { round_nr: roundNr } },
  };

  const handleAddPlayers = () => {
    if (!selectedPlayerIds.length) return;
    updateMutation.mutate(
      { ...roundParams, body: { player_ids_to_add: selectedPlayerIds.map(Number) } },
      { onSuccess: () => setSelectedPlayerIds([]) },
    );
  };

  const handleRemovePlayer = (playerId: number) => {
    updateMutation.mutate({ ...roundParams, body: { player_ids_to_remove: [playerId] } });
  };

  const handleSetBye = (playerId: number) => {
    updateMutation.mutate({ ...roundParams, body: { bye_player_id: playerId } });
  };

  const handleClearBye = () => {
    updateMutation.mutate({ ...roundParams, body: { clear_bye: true } });
  };

  const handleGeneratePairing = () => {
    const playerIds = roundPlayers
      .filter((rp: RoundPlayerPublic) => !rp.is_bye)
      .map((rp: RoundPlayerPublic) => rp.player.id);
    createPairingMutation.mutate(
      { params: { path: { name: competitionName } }, body: { round_nr: roundNr, player_ids: playerIds } },
      { onSuccess: onPairingCreated },
    );
  };

  const handleConfirmClearAll = () => {
    deleteMutation.mutate(
      { params: { path: { name: competitionName }, query: { round_nr: roundNr } } },
      { onSuccess: () => { closeClearModal(); onDraftCleared?.(); } },
    );
  };

  return (
    <Stack>
      <Title>
        Player list for round {roundNr} ({playerCount} players)
      </Title>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Player</Table.Th>
            {isOdd && <Table.Th>Bye</Table.Th>}
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {roundPlayers.map((rp: RoundPlayerPublic) => (
            <Table.Tr key={rp.id}>
              <Table.Td>{rp.player.name}</Table.Td>
              {isOdd && (
                <Table.Td>
                  <Radio
                    checked={rp.is_bye}
                    onChange={() => rp.is_bye ? handleClearBye() : handleSetBye(rp.player.id)}
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
            <Table.Td colSpan={isOdd ? 3 : 2}>
              <div
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !comboboxOpen && selectedPlayerIds.length) {
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
                    placeholder="Select players..."
                    comboboxProps={{ width: "max-content", position: "bottom-start" }}
                  />
                  <Button
                    onClick={handleAddPlayers}
                    disabled={!selectedPlayerIds.length || updateMutation.isPending}
                  >
                    Add
                  </Button>
                </Group>
              </div>
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>

      {isOdd && !byePlayer && (
        <Alert>
          Odd number of players. Select a bye player before generating the pairing.
        </Alert>
      )}

      <Group>
        <Button
          onClick={handleGeneratePairing}
          disabled={!canGenerate || createPairingMutation.isPending}
        >
          {createPairingMutation.isPending
            ? "Generating..."
            : `Generate pairing for round ${roundNr}`}
        </Button>
        <Button variant="default" onClick={openClearModal}>
          Clear All
        </Button>
      </Group>

      <Modal opened={clearModalOpened} onClose={closeClearModal} title="Clear all players">
        <Text>Are you sure you want to clear all players for this round?</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={closeClearModal}>Cancel</Button>
          <Button color="red" onClick={handleConfirmClearAll} loading={deleteMutation.isPending}>
            Clear All
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
