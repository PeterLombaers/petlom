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
import { formatHTTPValidationError } from "@/client/api";
import { AnyMutation } from "./types";

interface DeleteButtonProps {
  entityType: string;
  entityId: number | string;
  entityName: string;
  mutation: AnyMutation;
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
        aria-label="Delete"
      >
        <IconTrash size={18} />
      </ActionIcon>
      <Modal
        opened={dialogOpen}
        onClose={handleDialogClose}
        title="Confirm Delete"
      >
        <Stack>
          <Text>
            Do you want to delete the {entityType} {entityName}?
            {requireTypedConfirmation && (
              <>
                {" "}
                This action is irreversible. Type <b>{entityName}</b> to
                confirm.
              </>
            )}
          </Text>
          {requireTypedConfirmation && (
            <TextInput
              autoComplete="off"
              required
              name={`${entityType}-name`}
              id={`${entityType}-name`}
              label="Name"
              value={confirmDialogInput}
              onChange={(e) => setConfirmDialogInput(e.target.value)}
            />
          )}
          <Group>
            <Button
              onClick={handleDelete}
              disabled={!isConfirmed || mutation.isPending}
            >
              Delete {entityName}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
