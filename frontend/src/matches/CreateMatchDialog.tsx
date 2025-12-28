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
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { $api } from "@client/api";
import { components } from "@client/schema";
import PlayerSelect from "@components/PlayerSelect";

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
  const { mutate, reset, isSuccess, isPending } = $api.useMutation(
    "post",
    "/matches/",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/matches/"] });
      },
      onError: (error) => {
        setSnackbar({
          children: error.detail?.[0]?.msg || "An error occured",
          severity: "error",
        });
        console.error(error.detail);
      },
    }
  );

  const resetErrors = () => {
    setInputErrorWhite("");
    setInputErrorBlack("");
    setInputErrorBoard("");
    setSnackbar(null);
  };

  const resetData = () => {
    setPlayerWhite(null);
    setPlayerBlack(null);
    setBoard(default_board);
  };

  const handleClick = (closeOnSucces: boolean) => {
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
    mutate({
      body: {
        player_white_id: playerWhite.id,
        player_black_id: playerBlack.id,
        competition_name: competition_name,
        round: round,
        board: board,
      },
    });

    if (isSuccess) {
      resetErrors();
      resetData();
      // After creating a match we want the next match to have a board value of one
      // higher.
      setBoard(board + 1);
      if (closeOnSucces) {
        setOpen(false);
      }
    }
  };

  const handleCloseSnackbar = () => setSnackbar(null);

  const handleClose = () => {
    resetErrors();
    reset();
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
          <Button onClick={() => handleClick(true)} disabled={isPending}>
            <Typography>Add match and close</Typography>
          </Button>
          <Button onClick={() => handleClick(false)} disabled={isPending}>
            <Typography>Add match and next </Typography>
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
