import { ActionIcon, Group } from "@mantine/core";
import { IconPencil, IconCheck, IconX } from "@tabler/icons-react";

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
      <ActionIcon onClick={onEdit} disabled={isPending} aria-label="Edit">
        <IconPencil size={18} />
      </ActionIcon>
    );
  }

  return (
    <Group>
      <ActionIcon onClick={onSave} disabled={isPending} aria-label="Save">
        <IconCheck size={18} />
      </ActionIcon>
      <ActionIcon onClick={onCancel} disabled={isPending} aria-label="Cancel">
        <IconX size={18} />
      </ActionIcon>
    </Group>
  );
}
