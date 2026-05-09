import { Paper, Table, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { formatHTTPValidationError } from "@/client/api";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRanking } from "./useRanking";
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

  const colCount = 10;

  return (
    <Paper withBorder>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Td colSpan={colCount}>
              <Text>
                {roundNr !== undefined
                  ? t("ranking.titleAfterRound", { roundNr })
                  : t("ranking.title")}
              </Text>
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>{t("ranking.position")}</Table.Th>
            <Table.Th>{t("ranking.player")}</Table.Th>
            <Table.Th>{t("ranking.points")}</Table.Th>
            <Table.Th>{t("ranking.games")}</Table.Th>
            <Table.Th>{t("ranking.saldo")}</Table.Th>
            <Table.Th>{t("ranking.colorSaldo")}</Table.Th>
            <Table.Th>{t("ranking.wins")}</Table.Th>
            <Table.Th>{t("ranking.draws")}</Table.Th>
            <Table.Th>{t("ranking.losses")}</Table.Th>
            <Table.Th>{t("ranking.rating")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ranking && ranking.length > 0 ? (
            ranking.map((rank) => (
              <Table.Tr key={rank.player.id}>
                <Table.Td>{rank.position}</Table.Td>
                <Table.Td>{rank.player.name}</Table.Td>
                <Table.Td>{rank.points}</Table.Td>
                <Table.Td>{rank.games_played}</Table.Td>
                <Table.Td>{rank.saldo}</Table.Td>
                <Table.Td>{rank.color_saldo}</Table.Td>
                <Table.Td>{rank.wins}</Table.Td>
                <Table.Td>{rank.draws}</Table.Td>
                <Table.Td>{rank.losses}</Table.Td>
                <Table.Td>
                  {rank.current_rating != null ? Math.round(rank.current_rating) : "—"}
                </Table.Td>
              </Table.Tr>
            ))
          ) : (
            <Table.Tr>
              <Table.Td colSpan={colCount} c="dimmed" ta="center">
                {t("ranking.noData")}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
