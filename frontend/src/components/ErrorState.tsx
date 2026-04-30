import { Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert color="red" icon={<IconAlertCircle size={16} />} title="Error">
      {message}
    </Alert>
  );
}
