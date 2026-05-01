import { Paper, Table, Text } from "@mantine/core";
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
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Td colSpan={9}>
              <Text>
                {roundNr !== undefined
                  ? `Ranking after round ${roundNr}`
                  : "Ranking"}
              </Text>
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Player</Table.Th>
            <Table.Th>Points</Table.Th>
            <Table.Th>Games</Table.Th>
            <Table.Th>W</Table.Th>
            <Table.Th>D</Table.Th>
            <Table.Th>L</Table.Th>
            <Table.Th>Saldo</Table.Th>
            <Table.Th>Color saldo</Table.Th>
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
                <Table.Td>{rank.wins}</Table.Td>
                <Table.Td>{rank.draws}</Table.Td>
                <Table.Td>{rank.losses}</Table.Td>
                <Table.Td>{rank.saldo}</Table.Td>
                <Table.Td>{rank.color_saldo}</Table.Td>
              </Table.Tr>
            ))
          ) : (
            <Table.Tr>
              <Table.Td colSpan={9} c="dimmed" ta="center">
                No ranking data yet.
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
