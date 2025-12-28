import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { $api } from "@client/api";

export interface DeleteDialogProps {
  open: boolean;
  name: string;
  setOpen: (value: boolean) => void;
  onClose: (value: string) => void;
}

export function DeleteDialog({
  open,
  name,
  setOpen,
  onClose,
}: DeleteDialogProps) {
  const [deleteInput, setDeleteInput] = useState("");
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setDeleteInput(e.target.value);
  };
  const queryClient = useQueryClient();
  const { mutate, isSuccess, isPending } = $api.useMutation(
    "delete",
    "/competitions/{name}",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/competitions/"] });
        setOpen(false);
      },
    }
  );

  const handleClick = () => {
    mutate({
      params: {
        path: { name: name },
      },
    });
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete competition {name}?</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <DialogContentText>
            Do you want to delete the competition {name}? This action is
            irreversible. Type <b>{name}</b> to confirm.
          </DialogContentText>
          <TextField
            autoComplete="off"
            autoFocus
            fullWidth
            required
            name="competition-name"
            id="competition-name"
            label="Name"
            onChange={handleInputChange}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClick}
          disabled={deleteInput !== name || isPending}
        >
          {isSuccess ? (
            <Typography>Deleted!</Typography>
          ) : (
            <Typography>Delete {name}</Typography>
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
