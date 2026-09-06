import { useState } from "react";
import { Button } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";
import { notifyErrorMessage } from "@/ui/notify";
import { CsvExportPath, downloadCsv } from "./csv";

type CsvExportButtonProps = {
  path: CsvExportPath;
  competitionName: string;
  /** Omitted exports the latest round. */
  roundNr?: number;
  /** Used when the response carries no Content-Disposition filename. */
  fallbackFilename: string;
};

/**
 * Downloads one of the CSV exports of a round.
 *
 * The export endpoints are moderator-only, so the button renders nothing for
 * anyone else — the gate lives here rather than at each of the two call sites.
 */
export function CsvExportButton({
  path,
  competitionName,
  roundNr,
  fallbackFilename,
}: CsvExportButtonProps) {
  const { isModerator } = useAuth();
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);

  if (!isModerator) return null;

  const onClick = async () => {
    setIsPending(true);
    try {
      await downloadCsv(path, competitionName, roundNr, fallbackFilename);
    } catch {
      notifyErrorMessage(t("export.failed"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="default"
      size="compact-sm"
      leftSection={<IconDownload size={16} />}
      loading={isPending}
      onClick={onClick}
    >
      {t("export.csv")}
    </Button>
  );
}
