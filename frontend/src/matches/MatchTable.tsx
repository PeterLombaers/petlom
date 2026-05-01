import { useState } from "react";
import { Group, NumberInput, Paper, Stack, Table, Text } from "@mantine/core";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";

import { formatHTTPValidationError } from "@client/api";
import { components } from "@client/schema";
import EditableRow from "@components/EditableRow";
import {
  createNumberCell,
  createPlayerSelectCell,
  createResultToggleCell,
} from "@components/cellConfigs";
import { CreateButton, CreateDialogConfig } from "@components/CreateButton";
import PlayerSelect from "@components/PlayerSelect";
import { useMatches } from "./useMatches";
import { useAuth } from "@/auth";

type MatchPublic = components["schemas"]["MatchPublic"];
type PlayerPublicMinimal = components["schemas"]["PlayerPublicMinimal"];

const tableCells = {
  board: createNumberCell("board"),
  player_white: createPlayerSelectCell(),
  player_black: createPlayerSelectCell(),
  result: createResultToggleCell(),
};

type MatchListProps = {
  competition_name: string;
  round: number;
};

type MatchFormData = {
  board: number | null;
  player_white: PlayerPublicMinimal | null;
  player_black: PlayerPublicMinimal | null;
};

const emptyPlayer: PlayerPublicMinimal = { id: 0, name: "", is_active: true };

export const MatchList = ({ competition_name, round }: MatchListProps) => {
  const [editableId, setEditableId] = useState(-1);
  const { isModerator } = useAuth();
  const {
    matches,
    error,
    isPending,
    isError,
    createMutation,
    editMutation,
    deleteMutation,
  } = useMatches(competition_name, round);

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

  if (isPending || !matches) return <LoadingState />;
  if (isError) return <ErrorState message={formatHTTPValidationError(error)} />;

  const maxBoard =
    matches.length > 0 ? Math.max(...matches.map((match) => match.board)) : 0;

  const createDialogConfig: CreateDialogConfig<MatchFormData> = {
    getInitialFormData: () => ({
      board: maxBoard + 1,
      player_white: null,
      player_black: null,
    }),
    getNextFormData: (submitted) => ({
      board: submitted.board !== null ? submitted.board + 1 : null,
      player_white: null,
      player_black: null,
    }),
    validateForm: (formData) => {
      const errors: Record<string, string> = {};
      if (formData.board === null || formData.board < 1) {
        errors.board = "Board must be at least 1";
      } else if (matches.some((m) => m.board === formData.board)) {
        errors.board = `Board ${formData.board} already exists in this round`;
      }
      if (!formData.player_white || !formData.player_white.id) {
        errors.player_white = "White player is required";
      }
      if (!formData.player_black || !formData.player_black.id) {
        errors.player_black = "Black player is required";
      }
      return errors;
    },
    sanitizeForm: (formData) => formData,
    getRequestBody: (formData) => ({
      player_white_id: formData.player_white!.id,
      player_black_id: formData.player_black!.id,
      competition_name,
      round,
      board: formData.board!,
    }),
    renderContent: ({ formData, errors, onChange }) => (
      <Stack>
        <NumberInput
          label="Board Number"
          value={formData.board ?? ""}
          onChange={(val) => {
            onChange("board", val === "" ? null : Number(val));
          }}
          error={errors.board || undefined}
        />
        <PlayerSelect
          player={formData.player_white ?? emptyPlayer}
          setPlayer={(player) => onChange("player_white", player)}
          label="White Player"
          error={!!errors.player_white}
          helperText={errors.player_white}
        />
        <PlayerSelect
          player={formData.player_black ?? emptyPlayer}
          setPlayer={(player) => onChange("player_black", player)}
          label="Black Player"
          error={!!errors.player_black}
          helperText={errors.player_black}
        />
      </Stack>
    ),
  };

  const nCols = Object.keys(tableCells).length + (isModerator ? 1 : 0);

  return (
    <Paper withBorder>
      <Table style={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: 80 }} />
          <col />
          <col />
          <col style={{ width: 200 }} />
          {isModerator && <col style={{ width: 100 }} />}
        </colgroup>
        <Table.Thead>
          <Table.Tr>
            <Table.Td colSpan={nCols}>
              <Group justify="space-between">
                <Text>
                  {competition_name} — Round {round}
                </Text>
                {isModerator && (
                  <CreateButton
                    entityType="match"
                    mutation={createMutation}
                    dialogConfig={createDialogConfig}
                  />
                )}
              </Group>
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>Board</Table.Th>
            <Table.Th>White</Table.Th>
            <Table.Th>Black</Table.Th>
            <Table.Th>Result</Table.Th>
            {isModerator && <Table.Th>Actions</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {matches.length > 0 ? (
            matches.map((match) => (
              <EditableRow<MatchPublic>
                key={match.id}
                data={match}
                isEditing={editableId === match.id}
                setIsEditing={(isEditing: boolean) =>
                  setIsEditing(match.id, isEditing)
                }
                cells={tableCells}
                entityIdField="id"
                editConfig={
                  isModerator
                    ? {
                        editMutation,
                        validateData,
                        sanitizeData,
                        getRequestBody,
                      }
                    : undefined
                }
                deleteConfig={
                  isModerator
                    ? {
                        deleteMutation,
                        entityType: "match",
                        getEntityName: (m) => {
                          const result = m.result ? ` (${m.result})` : "";
                          return `${m.player_white.name} - ${m.player_black.name}${result}`;
                        },
                        requireTypedConfirmation: false,
                      }
                    : undefined
                }
              />
            ))
          ) : (
            <Table.Tr>
              <Table.Td colSpan={nCols} c="dimmed" ta="center">
                No matches yet.
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
};
