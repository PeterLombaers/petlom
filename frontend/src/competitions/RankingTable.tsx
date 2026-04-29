import { Table, Text } from "@mantine/core";
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
    return <Text>No ranking data.</Text>;
  }

  return (
    <Table>
      <Table.Thead>
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
        {ranking.map((rank) => (
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
        ))}
      </Table.Tbody>
    </Table>
  );
}
