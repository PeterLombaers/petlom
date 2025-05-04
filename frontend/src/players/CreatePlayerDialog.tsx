import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../client/api";

export interface CreateDialogProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export default function CreatePlayerDialog({
  open,
  setOpen,
}: CreateDialogProps) {
  const [name, setName] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.POST("/players/", {
        body: { name: name, is_active: true },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/players/"] });
      setName("");
      setOpen(false);
    },
    onError: (error) => {
      console.log(error.message);
    },
  });

  const handleNameChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setName(e.target.value);
    setInputError(null);
  };

  const handleClick = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setInputError("Name cannot be empty.");
      return;
    }
    mutation.mutate(trimmed);
  };

  const handleClose = () => {
    setName("");
    setInputError(null);
    mutation.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Add new player</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          required
          name="player-name"
          id="player-name"
          label="Name"
          value={name}
          onChange={handleNameChange}
          error={inputError !== null}
          helperText={inputError}
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
