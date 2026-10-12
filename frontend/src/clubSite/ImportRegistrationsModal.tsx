import { useState } from "react";
import {
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { formatHTTPValidationError } from "@client/api";
import { components } from "@client/schema";
import { ErrorState } from "@/ui/ErrorState";
import { LoadingState } from "@/ui/LoadingState";
import PlayerSelect from "@/players/PlayerSelect";
import NewPlayerButton from "@/players/NewPlayerButton";
import { useRegistrationImport } from "./useRegistrationImport";

type RegistrationImportPreview =
  components["schemas"]["RegistrationImportPreview"];
type PlayerRef = components["schemas"]["PlayerRef"];

/** `PlayerSelect`'s "nothing chosen yet" value. */
const NO_PLAYER: PlayerRef = { id: 0, name: "", is_active: true };

type ImportRow = {
  key: string;
  scrapedName: string;
  player: PlayerRef;
  include: boolean;
  approximate: boolean;
  kind: "matched" | "ambiguous" | "unmatched";
  /** Who the matcher could not choose between, for an ambiguous row. */
  candidates: PlayerRef[];
};

/**
 * Shows who signed up on the club website and which players they are.
 *
 * Mount it only while it is open, so each run reads the sign-up list afresh.
 * Every sign-up becomes an editable row: the automatic match is only a
 * proposal, and the moderator can point the row at a different player, create
 * the player they clearly do not have yet, or leave the row out entirely.
 *
 * It registers nobody: confirming hands the chosen players to the selector in
 * the registration editor, where they go through the same rating questions as
 * players picked by hand. That selector only knows about players who are not
 * registered yet, so `enrolledPlayerIds` keeps this modal from handing it an id
 * it would silently drop: those rows can be neither ticked nor chosen.
 */
export default function ImportRegistrationsModal({
  competitionName,
  roundNr,
  enrolledPlayerIds,
  onClose,
  onImport,
}: {
  competitionName: string;
  roundNr: number;
  enrolledPlayerIds: Set<number>;
  onClose: () => void;
  onImport: (playerIds: number[]) => void;
}) {
  const { t } = useTranslation();
  const { data, error, isPending, isError } = useRegistrationImport(
    competitionName,
    roundNr,
  );

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [seeded, setSeeded] = useState<RegistrationImportPreview | null>(null);

  // Seed the rows from the preview as soon as it arrives. The hook never
  // caches, refetches on nothing, and the modal is unmounted when closed, so
  // the preview is fetched once per open: this seeds the rows rather than
  // resetting edits underneath the moderator.
  if (data && data !== seeded) {
    setSeeded(data);
    setRows(buildRows(data, enrolledPlayerIds));
  }

  const setRowPlayer = (key: string, player: PlayerRef) =>
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, player, include: true } : row,
      ),
    );

  const toggleRow = (key: string) =>
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, include: !row.include } : row,
      ),
    );

  const toImport = [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.include &&
            row.player.id !== 0 &&
            !enrolledPlayerIds.has(row.player.id),
        )
        .map((row) => row.player.id),
    ),
  ];

  const handleImport = () => {
    onImport(toImport);
    onClose();
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={t("registration.importFromWebsite")}
      size="xl"
    >
      <Stack>
        {isPending && <LoadingState />}
        {isError && <ErrorState message={formatHTTPValidationError(error)} />}
        {data && (
          <ImportSummary
            preview={data}
            rows={rows}
            enrolledPlayerIds={enrolledPlayerIds}
            onSetPlayer={setRowPlayer}
            onToggle={toggleRow}
          />
        )}
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

/**
 * Flattens the preview's three buckets into one row per sign-up.
 *
 * Scraped names are not unique, so rows are keyed by bucket and position.
 * A row starts included when it already points at a player who is not
 * registered yet — everything else is something the moderator must decide.
 *
 * Whether a player is registered already comes from the round the editor is
 * showing rather than from the preview's own `already_registered`, so the rows
 * cannot disagree with the table the import adds to.
 */
function buildRows(
  preview: RegistrationImportPreview,
  enrolledPlayerIds: Set<number>,
): ImportRow[] {
  return [
    ...preview.matched.map((match, index) => ({
      key: `matched-${index}`,
      scrapedName: match.scraped_name,
      player: match.player,
      include: !enrolledPlayerIds.has(match.player.id),
      approximate: match.approximate,
      kind: "matched" as const,
      candidates: [],
    })),
    ...preview.ambiguous.map((entry, index) => ({
      key: `ambiguous-${index}`,
      scrapedName: entry.scraped_name,
      player: NO_PLAYER,
      include: false,
      approximate: false,
      kind: "ambiguous" as const,
      candidates: entry.candidates,
    })),
    ...preview.unmatched.map((scrapedName, index) => ({
      key: `unmatched-${index}`,
      scrapedName,
      player: NO_PLAYER,
      include: false,
      approximate: false,
      kind: "unmatched" as const,
      candidates: [],
    })),
  ];
}

function ImportSummary({
  preview,
  rows,
  enrolledPlayerIds,
  onSetPlayer,
  onToggle,
}: {
  preview: RegistrationImportPreview;
  rows: ImportRow[];
  enrolledPlayerIds: Set<number>;
  onSetPlayer: (key: string, player: PlayerRef) => void;
  onToggle: (key: string) => void;
}) {
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
      <Table.ScrollContainer minWidth={520} type="native">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("registration.importScrapedName")}</Table.Th>
              <Table.Th>{t("registration.player")}</Table.Th>
              <Table.Th />
              <Table.Th>{t("registration.importInclude")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <ImportRowView
                key={row.key}
                row={row}
                rows={rows}
                enrolledPlayerIds={enrolledPlayerIds}
                onSetPlayer={onSetPlayer}
                onToggle={onToggle}
              />
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

function ImportRowView({
  row,
  rows,
  enrolledPlayerIds,
  onSetPlayer,
  onToggle,
}: {
  row: ImportRow;
  rows: ImportRow[];
  enrolledPlayerIds: Set<number>;
  onSetPlayer: (key: string, player: PlayerRef) => void;
  onToggle: (key: string) => void;
}) {
  const { t } = useTranslation();

  // One player cannot stand for two sign-ups, and one this round already has
  // is nothing to import. PlayerSelect puts this row's own player back into its
  // options, so filtering them all out here is safe: an already-registered
  // match still shows the name it matched, it just cannot be chosen elsewhere.
  const takenIds = new Set([
    ...rows
      .filter((other) => other.key !== row.key && other.player.id !== 0)
      .map((other) => other.player.id),
    ...enrolledPlayerIds,
  ]);

  const alreadyRegistered = enrolledPlayerIds.has(row.player.id);

  return (
    <Table.Tr>
      <Table.Td>
        <Text c={alreadyRegistered ? "dimmed" : undefined}>
          {row.scrapedName}
        </Text>
        {row.candidates.length > 0 && (
          <Text size="xs" c="dimmed">
            {row.candidates.map((c) => c.name).join(", ")}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <PlayerSelect
          player={row.player}
          setPlayer={(player) => onSetPlayer(row.key, player)}
          filterOptions={(options) =>
            options.filter((p) => !takenIds.has(p.id))
          }
          placeholder={t("registration.importChoosePlayer")}
        />
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <NewPlayerButton
            initialName={row.scrapedName}
            onCreated={(player) =>
              onSetPlayer(row.key, {
                id: player.id,
                name: player.name,
                is_active: player.is_active,
              })
            }
          />
          {row.approximate && (
            <Badge variant="light">{t("registration.importApproximate")}</Badge>
          )}
          {row.kind === "ambiguous" && (
            <Badge variant="light" color="orange">
              {t("registration.importAmbiguous")}
            </Badge>
          )}
          {row.kind === "unmatched" && (
            <Badge variant="light" color="orange">
              {t("registration.importUnmatched")}
            </Badge>
          )}
          {alreadyRegistered && (
            <Badge variant="light" color="gray">
              {t("registration.importAlreadyRegistered")}
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        {alreadyRegistered ? (
          // Nothing to tick: they are on the round already. A check reads as
          // settled where a disabled box reads as a box you may not tick.
          <IconCheck
            size={18}
            color="var(--mantine-color-dimmed)"
            aria-label={t("registration.importAlreadyRegistered")}
          />
        ) : (
          <Checkbox
            checked={row.include}
            onChange={() => onToggle(row.key)}
            disabled={row.player.id === 0}
            aria-label={t("registration.importIncludeRow", {
              name: row.scrapedName,
            })}
          />
        )}
      </Table.Td>
    </Table.Tr>
  );
}
