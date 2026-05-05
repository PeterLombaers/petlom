import { Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <Alert
      color="red"
      icon={<IconAlertCircle size={16} />}
      title={t("common.error")}
    >
      {message}
    </Alert>
  );
}
