import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../client/api";
import { components } from "../client/schema";
import PlayerSelect from "../PlayerSelect";

type PlayerPublicMinimal = components["schemas"]["PlayerPublicMinimal"];

export interface CreateDialogProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  competition_name: string;
  round: number;
  board: number;
}

export default function CreateMatchDialog({
  open,
  setOpen,
  competition_name,
  round,
  board,
}: CreateDialogProps) {
  const [playerWhite, setPlayerWhite] = useState<PlayerPublicMinimal | null>(
    null
  );
  const [inputErrorWhite, setInputErrorWhite] = useState<string>("");
  const [playerBlack, setPlayerBlack] = useState<PlayerPublicMinimal | null>(
    null
  );
  const [inputErrorBlack, setInputErrorBlack] = useState<string>("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      white,
      black,
    }: {
      white: PlayerPublicMinimal;
      black: PlayerPublicMinimal;
    }) =>
      apiClient.POST("/matches/", {
        body: {
          player_white_id: white.id,
          player_black_id: black.id,
          competition_name: competition_name,
          round: round,
          board: board,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/matches/"] });
      setPlayerWhite(null);
      setPlayerBlack(null);
      setOpen(false);
    },
    onError: (error) => {
      console.log(error.message);
    },
  });

  const handleClick = () => {
    if (playerWhite === null || playerBlack === null) {
      setInputErrorWhite("White player should be set.");
      return;
    }
    mutation.mutate({ white: playerWhite, black: playerBlack });
  };

  const handleClose = () => {
    setInputErrorWhite("");
    setInputErrorBlack("");
    mutation.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>
        Add new match to round {round} of {competition_name}
      </DialogTitle>
      <DialogContent dividers>
        <PlayerSelect
          player={playerWhite ?? { id: 0, name: "", is_active: true }}
          setPlayer={(player) => {
            setPlayerWhite(player);
            setInputErrorWhite("");
          }}
          label="White Player"
          error={inputErrorWhite !== ""}
          helperText={inputErrorWhite}
        />
        <PlayerSelect
          player={playerBlack ?? { id: 0, name: "", is_active: true }}
          setPlayer={(player) => {
            setPlayerBlack(player);
            setInputErrorBlack("");
          }}
          label="Black Player"
          error={inputErrorBlack !== ""}
          helperText={inputErrorBlack}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClick} disabled={mutation.isPending}>
          <Typography>Add</Typography>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
