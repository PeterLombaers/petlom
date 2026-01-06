import { IconButton, Stack } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

interface EditButtonProps {
  isEditing: boolean;
  isPending: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EditButton({
  isEditing,
  isPending,
  onEdit,
  onSave,
  onCancel,
}: EditButtonProps) {
  if (!isEditing) {
    return (
      <IconButton onClick={onEdit} disabled={isPending} aria-label="Edit">
        <EditIcon />
      </IconButton>
    );
  }

  return (
    <Stack direction="row">
      <IconButton onClick={onSave} disabled={isPending} aria-label="Save">
        <CheckIcon />
      </IconButton>
      <IconButton onClick={onCancel} disabled={isPending} aria-label="Cancel">
        <CloseIcon />
      </IconButton>
    </Stack>
  );
}
