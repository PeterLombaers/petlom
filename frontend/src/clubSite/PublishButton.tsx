import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconExternalLink, IconWorldUpload } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";
import { useMatches } from "@/matches/useMatches";
import { usePublication } from "./usePublication";

type PublishButtonProps = {
  competitionName: string;
  roundNr: number;
  /** No categories means the post lands in WordPress's default category. */
  categoryIds: number[];
};

/**
 * Publishes a round to the club website: its pairings at first, and its results
 * and ranking once every result is in.
 *
 * One button for both, because publishing always sends the round as it is
 * now and replaces the round's post if there already is one. The confirmation
 * says which of the two it is going to be, and whether it creates or replaces.
 *
 * Renders nothing for anyone but a moderator, or when the server has no
 * credentials for the website.
 */
export function PublishButton({
  competitionName,
  roundNr,
  categoryIds,
}: PublishButtonProps) {
  const { isModerator } = useAuth();
  const { t, i18n } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { publication, publishMutation, publish } = usePublication(
    competitionName,
    roundNr,
    { enabled: isModerator },
  );
  const { rows: matches } = useMatches(competitionName, roundNr);

  const status = publication.data;
  if (!isModerator || !status?.enabled) return null;

  const resultCount = matches?.filter((m) => m.result != null).length ?? 0;
  const isComplete = !!matches?.length && resultCount === matches.length;
  const publishedAt = status.published_at
    ? new Date(status.published_at).toLocaleString(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const confirm = () => publish({ onSuccess: () => setConfirmOpen(false) });

  return (
    <>
      <Group gap={4}>
        <Button
          variant="default"
          leftSection={<IconWorldUpload size={16} />}
          onClick={() => setConfirmOpen(true)}
        >
          {t("clubSite.publish")}
        </Button>
        {status.url && (
          <Tooltip label={t("clubSite.viewPost")}>
            <ActionIcon
              component="a"
              href={status.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              size="lg"
              aria-label={t("clubSite.viewPost")}
            >
              <IconExternalLink size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("clubSite.confirmTitle", { roundNr })}
      >
        <Stack>
          <Text>
            {isComplete
              ? t("clubSite.publishResults", { roundNr })
              : t("clubSite.publishPairings", { roundNr })}
          </Text>
          {!isComplete && resultCount > 0 && (
            <Text size="sm" c="dimmed">
              {t("clubSite.partialResults", {
                count: resultCount,
                total: matches?.length ?? 0,
              })}
            </Text>
          )}
          <Text size="sm">
            {status.url ? (
              <>
                {t("clubSite.replacesPost", { publishedAt })}{" "}
                <Anchor
                  href={status.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("clubSite.viewPost")}
                </Anchor>
              </>
            ) : (
              t("clubSite.createsPost")
            )}
          </Text>
          {categoryIds.length === 0 && (
            <Alert color="yellow">{t("clubSite.noCategories")}</Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirm} loading={publishMutation.isPending}>
              {t("clubSite.publish")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
