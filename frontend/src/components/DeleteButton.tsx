import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import { UseMutationResult } from "@tanstack/react-query";
import { formatHTTPValidationError } from "@/client/api";

interface DeleteButtonProps {
  entityType: string;
  entityId: number | string;
  entityName: string;
  mutation: UseMutationResult<any, any, any, any>;
  requireTypedConfirmation?: boolean;
}

export default function DeleteButton({
  entityType,
  entityId,
  entityName,
  mutation,
  requireTypedConfirmation = true,
}: DeleteButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogInput, setConfirmDialogInput] = useState("");

  const handleConfirmDialogInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setConfirmDialogInput(e.target.value);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setConfirmDialogInput("");
  };

  const handleDialogOpen = () => {
    setDialogOpen(true);
  };

  const pathKey = typeof entityId === "number" ? "id" : "name";

  const handleDelete = () => {
    mutation.mutate(
      {
        params: { path: { [pathKey]: entityId } },
      },
      {
        onSuccess: () => {
          handleDialogClose();
        },
        onError: (error) => {
          const errorMessage = formatHTTPValidationError(error);
          console.error(errorMessage);
        },
      }
    );
  };

  const isConfirmed =
    !requireTypedConfirmation || confirmDialogInput === entityName;

  return (
    <>
      <IconButton
        onClick={handleDialogOpen}
        disabled={mutation.isPending}
        aria-label="Delete"
      >
        <DeleteIcon />
      </IconButton>
      <Dialog open={dialogOpen} onClose={handleDialogClose}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent dividers>
          <Stack>
            <DialogContentText>
              Do you want to delete the {entityType} {entityName}?
              {requireTypedConfirmation && (
                <>
                  {" "}
                  This action is irreversible. Type <b>{entityName}</b> to
                  confirm.
                </>
              )}
            </DialogContentText>
            {requireTypedConfirmation && (
              <TextField
                autoComplete="off"
                required
                name={`${entityType}-name`}
                id={`${entityType}-name`}
                label="Name"
                onChange={handleConfirmDialogInputChange}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDelete}
            disabled={!isConfirmed || mutation.isPending}
          >
            <Typography>Delete {entityName}</Typography>
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
