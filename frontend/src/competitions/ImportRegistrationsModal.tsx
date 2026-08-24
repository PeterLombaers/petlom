import {
  Anchor,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { formatHTTPValidationError } from "@client/api";
import { components } from "@client/schema";
import { ErrorState } from "@/ui/ErrorState";
import { LoadingState } from "@/ui/LoadingState";
import { PlayerName } from "@/ui/PlayerName";
import { useRegistrationImport } from "./useRegistrationImport";

type RegistrationImportPreview =
  components["schemas"]["RegistrationImportPreview"];

/**
 * Shows who signed up on the club website and which players they are.
 *
 * Mount it only while it is open, so each run reads the sign-up list afresh.
 * It registers nobody: confirming hands the matched players to the selector in
 * the registration editor, where they go through the same rating questions as
 * players picked by hand.
 */
export default function ImportRegistrationsModal({
  competitionName,
  roundNr,
  onClose,
  onImport,
}: {
  competitionName: string;
  roundNr: number;
  onClose: () => void;
  onImport: (playerIds: number[]) => void;
}) {
  const { t } = useTranslation();
  const { data, error, isPending, isError } = useRegistrationImport(
    competitionName,
    roundNr,
  );

  const toImport = (data?.matched ?? []).filter((m) => !m.already_registered);

  const handleImport = () => {
    onImport(toImport.map((m) => m.player.id));
    onClose();
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={t("registration.importFromWebsite")}
      size="lg"
    >
      <Stack>
        {isPending && <LoadingState />}
        {isError && <ErrorState message={formatHTTPValidationError(error)} />}
        {data && <ImportSummary preview={data} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleImport} disabled={toImport.length === 0}>
            {t("registration.importSelect", { count: toImport.length })}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ImportSummary({ preview }: { preview: RegistrationImportPreview }) {
  const { t } = useTranslation();

  if (preview.scraped_count === 0) {
    return <Text>{t("registration.importNobodySignedUp")}</Text>;
  }

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        {t("registration.importSource")}{" "}
        <Anchor href={preview.source_url} target="_blank" rel="noreferrer">
          {preview.source_url}
        </Anchor>
      </Text>
      <Text fw={500}>
        {t("registration.importMatched", {
          matched: preview.matched.length,
          scraped: preview.scraped_count,
        })}
      </Text>
      {preview.matched.length > 0 && (
        <Table.ScrollContainer minWidth={320} type="native">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("registration.importScrapedName")}</Table.Th>
                <Table.Th>{t("registration.player")}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {preview.matched.map((match) => (
                <Table.Tr key={match.scraped_name}>
                  <Table.Td>{match.scraped_name}</Table.Td>
                  <Table.Td>
                    <PlayerName
                      name={match.player.name}
                      isActive={match.player.is_active}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {match.approximate && (
                        <Badge variant="light">
                          {t("registration.importApproximate")}
                        </Badge>
                      )}
                      {match.already_registered && (
                        <Text size="sm" c="dimmed">
                          {t("registration.importAlreadyRegistered")}
                        </Text>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {preview.ambiguous.length > 0 && (
        <Stack gap={2}>
          <Title order={3} size="h6">
            {t("registration.importAmbiguous")}
          </Title>
          {preview.ambiguous.map((entry, index) => (
            <Text size="sm" key={`${entry.scraped_name}-${index}`}>
              <Text span fw={500}>
                {entry.scraped_name}
              </Text>{" "}
              — {entry.candidates.map((c) => c.name).join(", ")}
            </Text>
          ))}
        </Stack>
      )}
      {preview.unmatched.length > 0 && (
        <Stack gap={2}>
          <Title order={3} size="h6">
            {t("registration.importUnmatched")}
          </Title>
          <Text size="sm">{preview.unmatched.join(", ")}</Text>
        </Stack>
      )}
      {(preview.ambiguous.length > 0 || preview.unmatched.length > 0) && (
        <Text size="sm" c="dimmed">
          {t("registration.importAddByHand")}
        </Text>
      )}
    </Stack>
  );
}
