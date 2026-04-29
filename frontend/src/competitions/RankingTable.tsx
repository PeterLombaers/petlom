import { Paper, Table, Text } from "@mantine/core";
import { formatHTTPValidationError } from "@/client/api";
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

  if (isPending) return <Text>Loading ranking...</Text>;

  if (isError) {
    const errorMessage = formatHTTPValidationError(error);
    return <Text>Error loading ranking: {errorMessage}</Text>;
  }

  if (!ranking || ranking.length === 0) {
    return <Text c="dimmed">No ranking data.</Text>;
  }

  return (
    <Paper>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Player</Table.Th>
            <Table.Th style={{ textAlign: "right" }}>Points</Table.Th>
            <Table.Th style={{ textAlign: "right" }}>Games</Table.Th>
            <Table.Th style={{ textAlign: "right" }}>W</Table.Th>
            <Table.Th style={{ textAlign: "right" }}>D</Table.Th>
            <Table.Th style={{ textAlign: "right" }}>L</Table.Th>
            <Table.Th style={{ textAlign: "right" }}>Saldo</Table.Th>
            <Table.Th style={{ textAlign: "right" }}>Color saldo</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ranking.map((rank) => (
            <Table.Tr key={rank.player.id}>
              <Table.Td>{rank.position}</Table.Td>
              <Table.Td>{rank.player.name}</Table.Td>
              <Table.Td style={{ textAlign: "right" }}>{rank.points}</Table.Td>
              <Table.Td style={{ textAlign: "right" }}>
                {rank.games_played}
              </Table.Td>
              <Table.Td style={{ textAlign: "right" }}>{rank.wins}</Table.Td>
              <Table.Td style={{ textAlign: "right" }}>{rank.draws}</Table.Td>
              <Table.Td style={{ textAlign: "right" }}>{rank.losses}</Table.Td>
              <Table.Td style={{ textAlign: "right" }}>{rank.saldo}</Table.Td>
              <Table.Td style={{ textAlign: "right" }}>
                {rank.color_saldo}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
