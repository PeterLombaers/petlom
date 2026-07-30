import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { formatHTTPValidationError } from "@/client/api";
import { translateEntity } from "@/i18n/pluralizeEntity";
import { AnyMutation } from "./types";

interface DeleteButtonProps {
  entityType: string;
  entityId: number | string;
  entityIdField: string;
  entityName: string;
  mutation: AnyMutation;
  requireTypedConfirmation?: boolean;
}

export default function DeleteButton({
  entityType,
  entityId,
  entityIdField,
  entityName,
  mutation,
  requireTypedConfirmation = true,
}: DeleteButtonProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogInput, setConfirmDialogInput] = useState("");

  const handleDialogClose = () => {
    setDialogOpen(false);
    setConfirmDialogInput("");
  };

  const handleDialogOpen = () => {
    setDialogOpen(true);
  };

  const handleDelete = () => {
    mutation.mutate(
      {
        params: { path: { [entityIdField]: entityId } },
      },
      {
        onSuccess: () => {
          handleDialogClose();
        },
        onError: (error) => {
          const errorMessage = formatHTTPValidationError(error);
          console.error(errorMessage);
        },
      },
    );
  };

  const isConfirmed =
    !requireTypedConfirmation || confirmDialogInput === entityName;

  return (
    <>
      <ActionIcon
        onClick={handleDialogOpen}
        disabled={mutation.isPending}
        color="red"
        aria-label={t("common.delete")}
      >
        <IconTrash size={18} />
      </ActionIcon>
      <Modal
        opened={dialogOpen}
        onClose={handleDialogClose}
        title={t("delete.confirmDelete")}
      >
        <Stack>
          <Text>
            {t("delete.confirmPrompt", {
              entityType: translateEntity(t, entityType),
              entityName,
            })}
            {requireTypedConfirmation && (
              <> {t("delete.irreversiblePrompt", { entityName })}</>
            )}
          </Text>
          {requireTypedConfirmation && (
            <TextInput
              autoComplete="off"
              required
              name={`${entityType}-name`}
              id={`${entityType}-name`}
              label={t("common.name")}
              value={confirmDialogInput}
              onChange={(e) => setConfirmDialogInput(e.target.value)}
            />
          )}
          <Group>
            <Button
              onClick={handleDelete}
              disabled={!isConfirmed || mutation.isPending}
            >
              {t("delete.deleteEntity", { entityName })}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
