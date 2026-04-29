import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Paper,
  Radio,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import PlayerSelect from "@/components/PlayerSelect";
import { components } from "@/client/schema";
import { useRoundPlayers } from "./useRoundPlayers";
import { useState } from "react";

type PlayerPublicMinimal = components["schemas"]["PlayerPublicMinimal"];
type RoundPlayerPublic = components["schemas"]["RoundPlayerPublic"];

const emptyPlayer: PlayerPublicMinimal = { id: 0, name: "", is_active: true };

export default function RoundPlayerList({
  competitionName,
  roundNr,
  onPairingCreated,
}: {
  competitionName: string;
  roundNr: number;
  onPairingCreated: () => void;
}) {
  const {
    roundPlayers,
    isPending,
    isError,
    updateMutation,
    deleteMutation,
    createPairingMutation,
  } = useRoundPlayers(competitionName, roundNr);

  const [newPlayer, setNewPlayer] = useState<PlayerPublicMinimal>(emptyPlayer);

  if (isPending) return <Text>Loading player list...</Text>;
  if (isError || !roundPlayers) return <Text>Error loading player list.</Text>;

  const playerCount = roundPlayers.length;
  const isOdd = playerCount % 2 !== 0;
  const byePlayer = roundPlayers.find((rp: RoundPlayerPublic) => rp.is_bye);
  const canGenerate = playerCount >= 2 && (!isOdd || byePlayer);

  const enrolledPlayerIds = new Set(
    roundPlayers.map((rp: RoundPlayerPublic) => rp.player.id),
  );

  const handleAddPlayer = () => {
    if (!newPlayer.id) return;
    updateMutation.mutate(
      {
        params: {
          path: { name: competitionName },
          query: { round_nr: roundNr },
        },
        body: { player_ids_to_add: [newPlayer.id] },
      },
      { onSuccess: () => setNewPlayer(emptyPlayer) },
    );
  };

  const handleRemovePlayer = (playerId: number) => {
    updateMutation.mutate({
      params: {
        path: { name: competitionName },
        query: { round_nr: roundNr },
      },
      body: { player_ids_to_remove: [playerId] },
    });
  };

  const handleSetBye = (playerId: number) => {
    updateMutation.mutate({
      params: {
        path: { name: competitionName },
        query: { round_nr: roundNr },
      },
      body: { bye_player_id: playerId },
    });
  };

  const handleClearBye = () => {
    updateMutation.mutate({
      params: {
        path: { name: competitionName },
        query: { round_nr: roundNr },
      },
      body: { clear_bye: true },
    });
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

  const handleCancelDraft = () => {
    deleteMutation.mutate({
      params: {
        path: { name: competitionName },
        query: { round_nr: roundNr },
      },
    });
  };

  return (
    <Stack>
      <Title order={5}>
        Player list for round {roundNr} ({playerCount} players)
      </Title>

      {isOdd && !byePlayer && (
        <Alert color="yellow">
          Odd number of players. Select a bye player before generating the
          pairing.
        </Alert>
      )}

      <Paper>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Player</Table.Th>
              {isOdd && <Table.Th>Bye</Table.Th>}
              <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
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
                      onChange={() => {
                        if (rp.is_bye) {
                          handleClearBye();
                        } else {
                          handleSetBye(rp.player.id);
                        }
                      }}
                    />
                  </Table.Td>
                )}
                <Table.Td style={{ textAlign: "right" }}>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => handleRemovePlayer(rp.player.id)}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Td colSpan={isOdd ? 3 : 2}>
                <Group>
                  <PlayerSelect
                    player={newPlayer}
                    setPlayer={setNewPlayer}
                    label="Add player"
                    filterOptions={(options) =>
                      options.filter((o) => !enrolledPlayerIds.has(o.id))
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={handleAddPlayer}
                    disabled={!newPlayer.id}
                    style={{ alignSelf: "flex-end" }}
                  >
                    Add
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>

      <Group>
        <Button
          onClick={handleGeneratePairing}
          disabled={!canGenerate || createPairingMutation.isPending}
        >
          {createPairingMutation.isPending
            ? "Generating..."
            : `Generate pairing for round ${roundNr}`}
        </Button>
        <Button variant="outline" color="red" onClick={handleCancelDraft}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
