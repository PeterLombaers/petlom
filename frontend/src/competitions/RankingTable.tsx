import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { formatHTTPValidationError } from "@/client/api";
import { useRanking } from "./useRanking";

export default function RankingTable({
  competitionName,
  roundNr,
}: {
  competitionName: string;
  roundNr?: number;
}) {
  const { data: ranking, isPending, isError, error } = useRanking(
    competitionName,
    roundNr,
  );

  if (isPending) return <Typography>Loading ranking...</Typography>;

  if (isError) {
    const errorMessage = formatHTTPValidationError(error);
    return <Typography>Error loading ranking: {errorMessage}</Typography>;
  }

  if (!ranking || ranking.length === 0) {
    return <Typography color="text.secondary">No ranking data.</Typography>;
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Player</TableCell>
            <TableCell align="right">Points</TableCell>
            <TableCell align="right">Games</TableCell>
            <TableCell align="right">W</TableCell>
            <TableCell align="right">D</TableCell>
            <TableCell align="right">L</TableCell>
            <TableCell align="right">Saldo</TableCell>
            <TableCell align="right">Color saldo</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ranking.map((rank) => (
            <TableRow key={rank.player.id}>
              <TableCell>{rank.position}</TableCell>
              <TableCell>{rank.player.name}</TableCell>
              <TableCell align="right">{rank.points}</TableCell>
              <TableCell align="right">{rank.games_played}</TableCell>
              <TableCell align="right">{rank.wins}</TableCell>
              <TableCell align="right">{rank.draws}</TableCell>
              <TableCell align="right">{rank.losses}</TableCell>
              <TableCell align="right">{rank.saldo}</TableCell>
              <TableCell align="right">{rank.color_saldo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
