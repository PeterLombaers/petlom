import { NumberInput, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { components } from "@client/schema";
import EditableTable from "@components/EditableTable";
import {
  createNumberCell,
  createPlayerSelectCell,
  createResultToggleCell,
} from "@components/cellConfigs";
import { CreateDialogConfig } from "@components/CreateButton";
import PlayerSelect from "@components/PlayerSelect";
import { useMatches } from "./useMatches";

type MatchPublic = components["schemas"]["MatchPublic"];
type PlayerPublicMinimal = components["schemas"]["PlayerPublicMinimal"];

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

const sanitizeData = (match: MatchPublic) => match;

const getRequestBody = (match: MatchPublic) => ({
  player_white_id: match.player_white.id,
  player_black_id: match.player_black.id,
  board: match.board,
  result: match.result,
});

export const MatchList = ({ competition_name, round }: MatchListProps) => {
  const { t } = useTranslation();
  const queryResult = useMatches(competition_name, round);
  const matchList = queryResult.rows ?? [];
  const maxBoard =
    matchList.length > 0 ? Math.max(...matchList.map((m) => m.board)) : 0;

  const validateData = (match: MatchPublic) => {
    const errors: Partial<Record<keyof MatchPublic, string>> = {};
    if (!match.player_white?.id) errors.player_white = t("match.whiteRequired");
    if (!match.player_black?.id) errors.player_black = t("match.blackRequired");
    if (!match.board || match.board < 1) errors.board = t("match.boardMin");
    return errors;
  };

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
        errors.board = t("match.boardMin");
      } else if (matchList.some((m) => m.board === formData.board)) {
        errors.board = t("match.boardDuplicate", { board: formData.board });
      }
      if (!formData.player_white || !formData.player_white.id) {
        errors.player_white = t("match.whiteRequired");
      }
      if (!formData.player_black || !formData.player_black.id) {
        errors.player_black = t("match.blackRequired");
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
          value={formData.board ?? ""}
          onChange={(val) => {
            onChange("board", val === "" ? null : Number(val));
          }}
          error={errors.board || undefined}
        />
        <PlayerSelect
          player={formData.player_white ?? emptyPlayer}
          setPlayer={(player) => onChange("player_white", player)}
          error={!!errors.player_white}
          helperText={errors.player_white}
        />
        <PlayerSelect
          player={formData.player_black ?? emptyPlayer}
          setPlayer={(player) => onChange("player_black", player)}
          error={!!errors.player_black}
          helperText={errors.player_black}
        />
      </Stack>
    ),
  };

  return (
    <EditableTable<MatchPublic>
      queryResult={queryResult}
      entityType="match"
      columns={[
        { field: "id", isId: true, hidden: true },
        {
          field: "board",
          cell: createNumberCell("board"),
          header: t("match.board"),
          width: 80,
        },
        {
          field: "player_white",
          cell: createPlayerSelectCell(),
          header: t("match.white"),
        },
        {
          field: "player_black",
          cell: createPlayerSelectCell(),
          header: t("match.black"),
        },
        {
          field: "result",
          cell: createResultToggleCell(),
          width: 200,
          isEditable: true,
        },
      ]}
      title={t("match.roundTitle", {
        competitionName: competition_name,
        round,
      })}
      createConfig={createDialogConfig}
      editConfig={{ validateData, sanitizeData, getRequestBody }}
      deleteConfig={{
        getEntityName: (m) => {
          const result = m.result ? ` (${m.result})` : "";
          return `${m.player_white.name} - ${m.player_black.name}${result}`;
        },
        requireTypedConfirmation: false,
      }}
    />
  );
};
