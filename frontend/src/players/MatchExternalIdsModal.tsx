import {
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatHTTPValidationError } from "@client/api";
import { components } from "@client/schema";
import { ErrorState } from "@/ui/ErrorState";
import { PlayerName } from "@/ui/PlayerName";
import { EXTERNAL_SOURCES } from "./external";
import { useMatchExternalIds } from "./useMatchExternalIds";

type ExternalRatingSource = components["schemas"]["ExternalRatingSource"];
type ExternalIdMatchResult = components["schemas"]["ExternalIdMatchResult"];
type ExternalIdMatchSkip = components["schemas"]["ExternalIdMatchSkip"];

const SKIP_REASONS = ["ambiguous", "not_found", "taken"] as const;

/**
 * Fills in the external ids of every player that has none, by name.
 *
 * Mount it only while it is open, so each run starts without the previous
 * result. The run writes the ids it is sure of straight away and reports the
 * players it could not place; those are filled in one by one through the
 * search in the identifier field.
 */
export default function MatchExternalIdsModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [source, setSource] = useState<ExternalRatingSource>("fide");
  const [result, setResult] = useState<ExternalIdMatchResult | null>(null);
  const matchMutation = useMatchExternalIds();

  const handleSearch = () => {
    setResult(null);
    matchMutation.mutate(
      { params: { path: { source } }, body: {} },
      { onSuccess: setResult },
    );
  };

  return (
    <Modal opened onClose={onClose} title={t("player.findIds")} size="lg">
      <Stack>
        <Text size="sm">{t("player.findIdsDescription")}</Text>
        <SegmentedControl
          aria-label={t("player.searchSourceLabel")}
          value={source}
          onChange={(value) => {
            setSource(value as ExternalRatingSource);
            setResult(null);
          }}
          data={EXTERNAL_SOURCES.map((option) => ({
            value: option,
            label: t(`externalSource.${option}`),
          }))}
        />
        <Text size="sm" c="dimmed">
          {t("player.findIdsSlowWarning")}
        </Text>
        {matchMutation.isError && (
          <ErrorState
            message={formatHTTPValidationError(matchMutation.error)}
          />
        )}
        {result && <MatchSummary result={result} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("common.close")}
          </Button>
          <Button onClick={handleSearch} loading={matchMutation.isPending}>
            {t("player.findIdsRun")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function MatchSummary({ result }: { result: ExternalIdMatchResult }) {
  const { t } = useTranslation();

  if (result.searched === 0) {
    return <Text>{t("player.findIdsNothingToDo")}</Text>;
  }

  return (
    <Stack gap="xs">
      <Text fw={500}>
        {t("player.findIdsMatched", {
          matched: result.matched.length,
          searched: result.searched,
        })}
      </Text>
      {result.matched.length > 0 && (
        <Table.ScrollContainer minWidth={320} type="native">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("common.name")}</Table.Th>
                <Table.Th>{t("player.matchedWith")}</Table.Th>
                <Table.Th>{t("player.externalId")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.matched.map((match) => (
                <Table.Tr key={match.player_id}>
                  <Table.Td>
                    <PlayerName
                      name={match.player_name}
                      isActive={match.player_is_active}
                    />
                  </Table.Td>
                  <Table.Td>{match.external_name}</Table.Td>
                  <Table.Td>{match.external_id}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {result.skipped.length > 0 && (
        <Stack gap="xs">
          <Title order={3} size="h6">
            {t("player.findIdsSkipped")}
          </Title>
          {SKIP_REASONS.map((reason) => (
            <SkippedGroup
              key={reason}
              reason={reason}
              skipped={result.skipped.filter((s) => s.reason === reason)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function SkippedGroup({
  reason,
  skipped,
}: {
  reason: ExternalIdMatchSkip["reason"];
  skipped: ExternalIdMatchSkip[];
}) {
  const { t } = useTranslation();
  if (skipped.length === 0) return null;
  return (
    <Text size="sm">
      <Text span fw={500}>
        {t(`player.findIdsReason.${reason}`)}:
      </Text>{" "}
      {skipped.map((skip, i) => (
        <span key={skip.player_id}>
          {i > 0 && ", "}
          <PlayerName name={skip.player_name} isActive={skip.player_is_active} />
        </span>
      ))}
    </Text>
  );
}
