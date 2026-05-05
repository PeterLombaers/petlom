import { ActionIcon, Group } from "@mantine/core";
import { IconPencil, IconCheck, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  if (!isEditing) {
    return (
      <ActionIcon
        onClick={onEdit}
        disabled={isPending}
        aria-label={t("common.edit")}
      >
        <IconPencil size={18} />
      </ActionIcon>
    );
  }

  return (
    <Group>
      <ActionIcon
        onClick={onSave}
        disabled={isPending}
        aria-label={t("common.save")}
      >
        <IconCheck size={18} />
      </ActionIcon>
      <ActionIcon
        onClick={onCancel}
        disabled={isPending}
        aria-label={t("common.cancel")}
      >
        <IconX size={18} />
      </ActionIcon>
    </Group>
  );
}
