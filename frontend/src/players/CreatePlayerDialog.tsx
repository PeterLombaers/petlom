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
import { useState, useRef, useEffect } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  // Focus when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to wait for dialog animation
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.POST("/players/", {
        body: { name: name, is_active: true },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/players/"] });
      setName("");
      inputRef.current?.focus();
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

  const resetErrors = () => {
    setInputError(null);
  };

  const resetData = () => {
    setName("");
  };

  const handleClick = (closeOnSucces: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setInputError("Name cannot be empty.");
      return;
    }
    mutation.mutate(trimmed);
    if (mutation.isSuccess) {
      resetErrors();
      resetData();
      if (closeOnSucces) {
        setOpen(false);
      }
    }
  };

  const handleClose = () => {
    resetErrors();
    mutation.reset();
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Enter: Add and next
        handleClick(false);
      } else {
        // Enter: Add and close
        handleClick(true);
      }
    }
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Add new player</DialogTitle>
      <DialogContent dividers>
        <TextField
          inputRef={inputRef}
          fullWidth
          required
          name="player-name"
          id="player-name"
          label="Name"
          value={name}
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
          error={inputError !== null}
          helperText={inputError}
        />
      </DialogContent>
      <DialogActions>
        <Tooltip title="Enter">
          <Button
            onClick={() => handleClick(true)}
            disabled={mutation.isPending}
          >
            <Typography>Add player and close</Typography>
          </Button>
        </Tooltip>
        <Tooltip title="Shift+Enter">
          <Button
            onClick={() => handleClick(false)}
            disabled={mutation.isPending}
          >
            <Typography>Add player and next </Typography>
          </Button>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
