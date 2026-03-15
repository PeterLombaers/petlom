import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { $api, formatHTTPValidationError } from "@client/api";
import { components } from "@client/schema";
import EditableRow from "@components/EditableRow";
import {
  createNumberCell,
  createPlayerSelectCell,
  createResultToggleCell,
} from "@components/cellConfigs";
import CreateMatchDialog from "./CreateMatchDialog";

type MatchPublic = components["schemas"]["MatchPublic"];

const tableCells = {
  board: createNumberCell("board", "Board"),
  player_white: createPlayerSelectCell("White"),
  player_black: createPlayerSelectCell("Black"),
  result: createResultToggleCell(),
};

type MatchListProps = {
  competition_name: string;
  round: number;
  max_board: number;
};

export const MatchList = ({ competition_name, round }: MatchListProps) => {
  const [editableId, setEditableId] = useState(-1);
  const [addMatchOpen, setAddMatchOpen] = useState(false);

  const {
    data: matches,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/competitions/{name}/round/{round_nr}", {
    params: { path: { name: competition_name, round_nr: round } },
  });

  const queryClient = useQueryClient();

  const editMutation = $api.useMutation("patch", "/matches/{id}", {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["get", "/competitions/{name}/round/{round_nr}"],
      });
    },
    onError: (error) => {
      console.log(formatHTTPValidationError(error));
    },
  });

  const deleteMutation = $api.useMutation("delete", "/matches/{id}", {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["get", "/competitions/{name}/round/{round_nr}"],
      });
    },
    onError: (error) => {
      console.log(formatHTTPValidationError(error));
    },
  });

  const setIsEditing = (matchId: number, isEditing: boolean) => {
    setEditableId(isEditing ? matchId : -1);
  };

  const sanitizeData = (match: MatchPublic) => match;

  const validateData = (match: MatchPublic) => {
    const errors: Partial<Record<keyof MatchPublic, string>> = {};
    if (!match.player_white?.id) {
      errors.player_white = "White player is required";
    }
    if (!match.player_black?.id) {
      errors.player_black = "Black player is required";
    }
    if (!match.board || match.board < 1) {
      errors.board = "Board must be at least 1";
    }
    return errors;
  };

  const getRequestBody = (match: MatchPublic) => ({
    player_white_id: match.player_white.id,
    player_black_id: match.player_black.id,
    board: match.board,
    result: match.result,
  });

  if (isPending || !matches) return "Loading...";

  if (isError) {
    const errorMessage = formatHTTPValidationError(error);
    console.log(errorMessage);
    return `An error occured: ${errorMessage}`;
  }

  const maxBoard =
    matches.length > 0 ? Math.max(...matches.map((match) => match.board)) : 0;

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell colSpan={Object.keys(tableCells).length + 1}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography>
                  {competition_name} — Round {round}
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setAddMatchOpen(true)}
                >
                  Add match
                </Button>
              </Stack>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Board</TableCell>
            <TableCell>White</TableCell>
            <TableCell>Black</TableCell>
            <TableCell>Result</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {matches.map((match) => (
            <EditableRow<MatchPublic>
              key={match.id}
              data={match}
              isEditing={editableId === match.id}
              setIsEditing={(isEditing: boolean) =>
                setIsEditing(match.id, isEditing)
              }
              cells={tableCells}
              entityIdField="id"
              editConfig={{
                editMutation,
                validateData,
                sanitizeData,
                getRequestBody,
              }}
              deleteConfig={{
                deleteMutation,
                entityType: "match",
                entityNameField: "id",
              }}
            />
          ))}
        </TableBody>
      </Table>
      <CreateMatchDialog
        open={addMatchOpen}
        setOpen={setAddMatchOpen}
        competition_name={competition_name}
        round={round}
        default_board={maxBoard + 1}
      />
    </TableContainer>
  );
};
