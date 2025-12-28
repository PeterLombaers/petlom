import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Tooltip,
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

export default function CreateDialog({
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
      apiClient.POST("/competitions/", {
        body: { name: name, type: "simkro" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/competitions/"] });
      setOpen(false);
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      mutation.mutate(name);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Create New Competition</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          required
          name="competition-name"
          id="competition-name"
          label="Name"
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
        />
      </DialogContent>
      <DialogActions>
        <Tooltip title="Enter">
          <Button
            onClick={() => mutation.mutate(name)}
            disabled={mutation.isPending}
          >
            <Typography>Create</Typography>
          </Button>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
