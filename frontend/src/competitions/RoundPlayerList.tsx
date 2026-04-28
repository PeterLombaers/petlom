import {
  Alert,
  Button,
  IconButton,
  Paper,
  Radio,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
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

  if (isPending) return <Typography>Loading player list...</Typography>;
  if (isError || !roundPlayers) return <Typography>Error loading player list.</Typography>;

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
    <Stack spacing={2}>
      <Typography variant="h6">
        Player list for round {roundNr} ({playerCount} players)
      </Typography>

      {isOdd && !byePlayer && (
        <Alert severity="warning">
          Odd number of players. Select a bye player before generating the
          pairing.
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Player</TableCell>
              {isOdd && <TableCell>Bye</TableCell>}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roundPlayers.map((rp: RoundPlayerPublic) => (
              <TableRow key={rp.id}>
                <TableCell>{rp.player.name}</TableCell>
                {isOdd && (
                  <TableCell>
                    <Radio
                      checked={rp.is_bye}
                      onChange={() => {
                        if (rp.is_bye) {
                          handleClearBye();
                        } else {
                          handleSetBye(rp.player.id);
                        }
                      }}
                      size="small"
                    />
                  </TableCell>
                )}
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => handleRemovePlayer(rp.player.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={isOdd ? 3 : 2}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <PlayerSelect
                    player={newPlayer}
                    setPlayer={setNewPlayer}
                    label="Add player"
                    filterOptions={(options) =>
                      options.filter((o) => !enrolledPlayerIds.has(o.id))
                    }
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleAddPlayer}
                    disabled={!newPlayer.id}
                  >
                    Add
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          onClick={handleGeneratePairing}
          disabled={!canGenerate || createPairingMutation.isPending}
        >
          {createPairingMutation.isPending
            ? "Generating..."
            : `Generate pairing for round ${roundNr}`}
        </Button>
        <Button variant="outlined" color="error" onClick={handleCancelDraft}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}
