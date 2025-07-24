import {
  Alert,
  AlertProps,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createMatch } from "../client/api";
import { components } from "../client/schema";
import PlayerSelect from "../PlayerSelect";

type PlayerPublicMinimal = components["schemas"]["PlayerPublicMinimal"];

export interface CreateDialogProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  competition_name: string;
  round: number;
  default_board: number;
}

export default function CreateMatchDialog({
  open,
  setOpen,
  competition_name,
  round,
  default_board,
}: CreateDialogProps) {
  const [playerWhite, setPlayerWhite] = useState<PlayerPublicMinimal | null>(
    null
  );
  const [inputErrorWhite, setInputErrorWhite] = useState<string>("");
  const [playerBlack, setPlayerBlack] = useState<PlayerPublicMinimal | null>(
    null
  );
  const [inputErrorBlack, setInputErrorBlack] = useState<string>("");
  const [board, setBoard] = useState<number | null>(default_board);
  const [inputErrorBoard, setInputErrorBoard] = useState<string>("");
  const [snackbar, setSnackbar] = useState<Pick<
    AlertProps,
    "children" | "severity"
  > | null>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      white,
      black,
      board,
    }: {
      white: PlayerPublicMinimal;
      black: PlayerPublicMinimal;
      board: number;
    }) =>
      createMatch({
        player_white_id: white.id,
        player_black_id: black.id,
        competition_name,
        round,
        board,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/matches/"] });
      setPlayerWhite(null);
      setPlayerBlack(null);
      setBoard(default_board);
      setOpen(false);
    },
    onError: (error) => {
      setSnackbar({ children: error.message, severity: "error" });
      console.error(error.message);
    },
  });

  const handleClick = () => {
    if (playerWhite === null || playerBlack === null || board === null) {
      if (playerWhite === null) {
        setInputErrorWhite("White player should be set.");
      }
      if (playerBlack === null) {
        setInputErrorBlack("Black player should be set.");
      }
      if (board === null) {
        setInputErrorBoard("Board should be set.");
      }
      return;
    }

    mutation.mutate({ white: playerWhite, black: playerBlack, board: board });
  };

  const handleCloseSnackbar = () => setSnackbar(null);

  const handleClose = () => {
    setInputErrorWhite("");
    setInputErrorBlack("");
    setInputErrorBoard("");
    setSnackbar(null);
    mutation.reset();
    setOpen(false);
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          Add new match to round {round} of {competition_name}
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Board Number"
            type="number"
            value={board ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setBoard(value === "" ? null : Number(value));
              setInputErrorBoard("");
            }}
            error={inputErrorBoard !== ""}
            helperText={inputErrorBoard}
          />
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
      {!!snackbar && (
        <Snackbar
          open
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          onClose={handleCloseSnackbar}
          autoHideDuration={10000}
        >
          <Alert {...snackbar} onClose={handleCloseSnackbar} />
        </Snackbar>
      )}
    </>
  );
}
