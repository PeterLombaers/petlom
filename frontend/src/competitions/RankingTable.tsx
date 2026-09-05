import { Paper, Table, Text } from "@mantine/core";
import type { ParseKeys } from "i18next";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatHTTPValidationError } from "@/client/api";
import { components } from "@/client/schema";
import { ErrorState } from "@/ui/ErrorState";
import { LoadingState } from "@/ui/LoadingState";
import { PlayerName } from "@/ui/PlayerName";
import { RatingValue } from "@/ui/RatingValue";
import { useRanking } from "./useRanking";

type SimkroRank = components["schemas"]["SimkroRank"];

const COLUMNS: { key: ParseKeys; render: (rank: SimkroRank) => ReactNode }[] = [
  { key: "ranking.position", render: (rank) => rank.position },
  {
    key: "ranking.player",
    render: (rank) => (
      <PlayerName name={rank.player.name} isActive={rank.player.is_active} />
    ),
  },
  { key: "ranking.points", render: (rank) => rank.points },
  { key: "ranking.games", render: (rank) => rank.games_played },
  { key: "ranking.saldo", render: (rank) => rank.saldo },
  { key: "ranking.colorSaldo", render: (rank) => rank.color_saldo },
  { key: "ranking.wins", render: (rank) => rank.wins },
  { key: "ranking.draws", render: (rank) => rank.draws },
  { key: "ranking.losses", render: (rank) => rank.losses },
  {
    key: "ranking.rating",
    render: (rank) => <RatingValue value={rank.current_rating} />,
  },
];

export default function RankingTable({
  competitionName,
  roundNr,
}: {
  competitionName: string;
  roundNr?: number;
}) {
  const { t } = useTranslation();
  const {
    data: ranking,
    isPending,
    isError,
    error,
  } = useRanking(competitionName, roundNr);

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={formatHTTPValidationError(error)} />;

  return (
    <Paper withBorder>
      <Table.ScrollContainer minWidth={700} type="native">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Td colSpan={COLUMNS.length}>
                <Text>
                  {roundNr !== undefined
                    ? t("ranking.titleAfterRound", { roundNr })
                    : t("ranking.title")}
                </Text>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              {COLUMNS.map((column) => (
                <Table.Th key={column.key}>{t(column.key)}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ranking && ranking.length > 0 ? (
              ranking.map((rank) => (
                <Table.Tr key={rank.player.id}>
                  {COLUMNS.map((column) => (
                    <Table.Td key={column.key}>{column.render(rank)}</Table.Td>
                  ))}
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={COLUMNS.length} c="dimmed" ta="center">
                  {t("ranking.noData")}
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
