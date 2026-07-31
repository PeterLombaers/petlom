import {
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { $api } from "@client/api";
import { components } from "@/client/schema";
import { getRating } from "@/players/external";

/** The full player record, so the FIDE rating in the response is available. */
export type PlayerNeedingRating = components["schemas"]["PlayerPublic"];

/** Where a player's initial rating comes from. */
type SeedSource = "manual" | "external" | "competition";

/** A rating list, in the `YYYY-MM` form the backend's `list_date` accepts. */
const LIST_DATE_PATTERN = /^\d{4}-\d{2}$/;

/**
 * Asks for an initial rating per player, seeded from FIDE or from a previous
 * competition. Mount it only while ratings are needed, so each round of
 * questions starts with empty inputs.
 *
 * The source competition and the rating list stay visible whatever the bulk
 * source is: both feed a column of the table, and a single player can be
 * switched to a competition after everyone was seeded from FIDE.
 */
export default function SeedRatingsModal({
  players,
  competitionName,
  onClose,
  onConfirm,
  isPending = false,
}: {
  players: PlayerNeedingRating[];
  competitionName: string;
  onClose: () => void;
  onConfirm: (initialRatings: Record<number, number>) => void;
  isPending?: boolean;
}) {
  const { t } = useTranslation();
  const [ratings, setRatings] = useState<Record<number, number | string>>(() =>
    Object.fromEntries(players.map((p) => [p.id, ""])),
  );
  const [sources, setSources] = useState<Record<number, SeedSource>>(() =>
    Object.fromEntries(players.map((p) => [p.id, "manual"])),
  );
  const [bulkSource, setBulkSource] = useState<SeedSource>("external");
  const [sourceCompetition, setSourceCompetition] = useState<string | null>(
    null,
  );
  const [listDate, setListDate] = useState("");

  const hasListDate = LIST_DATE_PATTERN.test(listDate);

  const { data: competitions } = $api.useQuery("get", "/competitions/");

  const { data: competitionRatings } = $api.useQuery(
    "get",
    "/competitions/{name}/player-ratings",
    { params: { path: { name: sourceCompetition ?? "" } } },
    { enabled: !!sourceCompetition },
  );

  // Only fetched for a specific rating list; without one the players already
  // carry their newest FIDE rating.
  const { data: playersAtListDate } = $api.useQuery(
    "get",
    "/players/",
    { params: { query: { list_date: listDate } } },
    { enabled: hasListDate },
  );

  const ratedPlayers = hasListDate ? (playersAtListDate ?? []) : players;

  const externalRating = (playerId: number) => {
    const player = ratedPlayers.find((p) => p.id === playerId);
    const rating = player ? getRating(player, "fide") : null;
    return rating ? Math.round(rating.rating) : null;
  };

  const competitionRating = (playerId: number) => {
    const rating = (competitionRatings ?? []).find(
      (r) => r.player_id === playerId,
    );
    return rating ? Math.round(rating.current_rating) : null;
  };

  const valueFrom = (playerId: number, source: SeedSource) => {
    if (source === "external") return externalRating(playerId);
    if (source === "competition") return competitionRating(playerId);
    return null;
  };

  const handleSourceChange = (playerId: number, source: SeedSource) => {
    setSources((prev) => ({ ...prev, [playerId]: source }));
    const value = valueFrom(playerId, source);
    if (value != null) setRatings((prev) => ({ ...prev, [playerId]: value }));
  };

  const handleApplyBulk = () => {
    const seeded = players
      .map((p) => [p.id, valueFrom(p.id, bulkSource)] as const)
      .filter(([, value]) => value != null);
    setSources((prev) => ({
      ...prev,
      ...Object.fromEntries(seeded.map(([id]) => [id, bulkSource])),
    }));
    setRatings((prev) => ({ ...prev, ...Object.fromEntries(seeded) }));
  };

  const isFilled = (value: number | string | undefined) =>
    value !== "" && value != null;
  const allRatingsFilled = players.every((p) => isFilled(ratings[p.id]));

  const handleConfirm = () => {
    if (!allRatingsFilled) return;
    onConfirm(
      Object.fromEntries(players.map((p) => [p.id, Number(ratings[p.id])])),
    );
  };

  const sourceOptions = (playerId: number) => [
    { value: "manual", label: t("rating.sourceManual") },
    {
      value: "external",
      label: t("rating.sourceExternal"),
      disabled: externalRating(playerId) == null,
    },
    {
      value: "competition",
      label: t("rating.sourceCompetition"),
      disabled: competitionRating(playerId) == null,
    },
  ];

  return (
    <Modal
      opened
      onClose={onClose}
      title={t("rating.setRatingsTitle")}
      size="xl"
    >
      <Stack>
        <Text size="sm">{t("rating.setRatingsDescription")}</Text>

        <Group align="flex-end">
          <SegmentedControl
            aria-label={t("rating.seedAllFrom")}
            value={bulkSource}
            onChange={(value) => setBulkSource(value as SeedSource)}
            data={[
              { value: "manual", label: t("rating.sourceManual") },
              { value: "external", label: t("rating.sourceExternal") },
              { value: "competition", label: t("rating.sourceCompetition") },
            ]}
          />
          <Button onClick={handleApplyBulk} disabled={bulkSource === "manual"}>
            {t("rating.seedAll")}
          </Button>
        </Group>

        <Group grow align="flex-start">
          <Select
            label={t("rating.sourceCompetitionLabel")}
            placeholder={t("rating.selectCompetition")}
            searchable
            clearable
            value={sourceCompetition}
            onChange={setSourceCompetition}
            data={(competitions ?? [])
              .filter((c) => c.name !== competitionName)
              .map((c) => c.name)}
          />
          <TextInput
            label={t("rating.listDateLabel")}
            placeholder="2026-05"
            value={listDate}
            error={
              listDate && !hasListDate ? t("rating.listDateInvalid") : undefined
            }
            onChange={(e) => setListDate(e.currentTarget.value)}
          />
        </Group>

        <Table.ScrollContainer minWidth={600} type="native">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("registration.player")}</Table.Th>
                <Table.Th>{t("player.fideRating")}</Table.Th>
                <Table.Th>{t("rating.competitionRating")}</Table.Th>
                <Table.Th>{t("rating.source")}</Table.Th>
                <Table.Th>{t("player.initialRating")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {players.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.name}</Table.Td>
                  <Table.Td>{externalRating(p.id) ?? "—"}</Table.Td>
                  <Table.Td>{competitionRating(p.id) ?? "—"}</Table.Td>
                  <Table.Td>
                    <Select
                      aria-label={t("rating.sourceFor", { playerName: p.name })}
                      allowDeselect={false}
                      value={sources[p.id]}
                      onChange={(value) =>
                        handleSourceChange(p.id, value as SeedSource)
                      }
                      data={sourceOptions(p.id)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      aria-label={t("rating.initialRatingLabel", {
                        playerName: p.name,
                      })}
                      value={ratings[p.id]}
                      onChange={(v) =>
                        setRatings((prev) => ({ ...prev, [p.id]: v }))
                      }
                      min={0}
                      allowDecimal={false}
                      required
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allRatingsFilled || isPending}
            loading={isPending}
          >
            {t("rating.confirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
