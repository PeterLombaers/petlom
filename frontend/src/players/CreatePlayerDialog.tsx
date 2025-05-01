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
  onClose: (value: string) => void;
}

export default function CreatePlayerDialog({
  open,
  setOpen,
  onClose,
}: CreateDialogProps) {
  const [name, setName] = useState("");
  const handleNameChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setName(e.target.value);
  };
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.POST("/players/", {
        body: { name: name, is_active: true },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/players/"] });
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add new player</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          required
          name="player-name"
          id="player-name"
          label="Name"
          onChange={handleNameChange}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => mutation.mutate(name)}
          disabled={mutation.isPending}
        >
          <Typography>Add</Typography>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
