import { useParams } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getCompetitionRound } from "../client/api";
import {
  Card,
  FormControlLabel,
  FormGroup,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { components } from "../client/schema";
import ResultToggle from "../ResultToggle";
import PlayerSelect from "../PlayerSelect";
import { useState } from "react";
import { resultToString } from "../utils";

type MatchUpdate = components["schemas"]["MatchUpdate"];

export default function CompetitionRoundPage() {
  const [isResultEditable, setIsResultEditable] = useState(false);
  const [isPlayersEditable, setIsPlayersEditable] = useState(false);

  const { name, round } = useParams();
  if (!name || !round) {
    return <NotFoundPage />;
  }
  const round_nr = parseInt(round);
  if (!round_nr) {
    return <NotFoundPage />;
  }
  const queryClient = useQueryClient();
  const matchMutation = useMutation({
    mutationFn: ({ id, update }: { id: number; update: MatchUpdate }) => {
      return apiClient.PATCH("/matches/{id}", {
        params: { path: { id: id } },
        body: update,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/competitions/", "GET", name, round_nr],
      });
    },
    onError: (error) => {
      console.log(error.message);
    },
  });
  const {
    data: competition,
    error,
    isPending,
  } = useQuery({
    queryKey: ["/competitions/", "GET", name, round_nr],
    queryFn: () => getCompetitionRound(name, round_nr),
  });

  if (isPending) {
    return <div>Loading...</div>;
  }
  if (error || !competition) {
    console.log(error);
    return <NotFoundPage />;
  }

  const parsedCreatedDate = new Date(Date.parse(competition.created_at));
  const parsedUpdatedDate = new Date(Date.parse(competition.updated_at));

  return (
    <Stack spacing={1}>
      <Card>
        <Typography>Competition {competition.name}</Typography>
        <Typography>Type: {competition.type}</Typography>
        <Typography>Created: {parsedCreatedDate.toDateString()}</Typography>
        <Typography>Updated: {parsedUpdatedDate.toDateString()}</Typography>
        <Typography> Round {round}</Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={isResultEditable}
                onChange={() => setIsResultEditable(!isResultEditable)}
              />
            }
            label="Edit Results"
          />
          <FormControlLabel
            control={
              <Switch
                checked={isPlayersEditable}
                onChange={() => setIsPlayersEditable(!isPlayersEditable)}
              />
            }
            label="Edit Players"
          />
        </FormGroup>
      </Card>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Board</TableCell>
              <TableCell>White</TableCell>
              <TableCell>Black</TableCell>
              <TableCell>Result</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {competition.matches.map((match) => (
              <TableRow key={match.id}>
                <TableCell>{match.board}.</TableCell>
                <TableCell>
                  {isPlayersEditable ? (
                    <PlayerSelect
                      player={match.player_white}
                      setPlayer={(player) =>
                        matchMutation.mutate({
                          id: match.id,
                          update: { player_white_id: player.id },
                        })
                      }
                      label="Player White"
                    />
                  ) : (
                    match.player_white.name
                  )}
                </TableCell>
                <TableCell>
                  {isPlayersEditable ? (
                    <PlayerSelect
                      player={match.player_black}
                      setPlayer={(player) =>
                        matchMutation.mutate({
                          id: match.id,
                          update: { player_black_id: player.id },
                        })
                      }
                      label="Player Black"
                    />
                  ) : (
                    match.player_black.name
                  )}
                </TableCell>
                <TableCell>
                  {isResultEditable ? (
                    <ResultToggle
                      result={match.result}
                      setResult={(result) => {
                        matchMutation.mutate({
                          id: match.id,
                          update: { result: result },
                        });
                      }}
                    />
                  ) : (
                    resultToString(match.result)
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
