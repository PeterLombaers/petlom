import { NumberInput, Stack, useMantineTheme } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { components } from "@client/schema";
import EditableTable from "@/table/EditableTable";
import { createNumberCell } from "@/table/cells";
import { CreateDialogConfig } from "@/table/CreateButton";
import PlayerSelect from "@/players/PlayerSelect";
import { playerSelectCell, resultToggleCell } from "./cells";
import { useMatches } from "./useMatches";

type MatchPublic = components["schemas"]["MatchPublic"];
type PlayerRef = components["schemas"]["PlayerRef"];

type MatchTableProps = {
  competitionName: string;
  round: number;
};

type MatchFormData = {
  board: number | null;
  player_white: PlayerRef | null;
  player_black: PlayerRef | null;
};

const emptyPlayer: PlayerRef = { id: 0, name: "", is_active: true };

const sanitizeData = (match: MatchPublic) => match;

const getRequestBody = (match: MatchPublic) => ({
  player_white_id: match.player_white.id,
  player_black_id: match.player_black.id,
  board: match.board,
  result: match.result,
});

export const MatchTable = ({ competitionName, round }: MatchTableProps) => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isSmallScreen = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  // The result toggle needs ~220px while editing. On large screens we keep the
  // column at that width so it never jumps; on small screens it stays compact and
  // only expands (via editWidth) while the result column is being edited.
  const resultWidth = isSmallScreen ? 90 : 220;
  const queryResult = useMatches(competitionName, round);
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
      competition_name: competitionName,
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
          label={t("match.board")}
          error={errors.board || undefined}
        />
        <PlayerSelect
          player={formData.player_white ?? emptyPlayer}
          setPlayer={(player) => onChange("player_white", player)}
          error={!!errors.player_white}
          label={t("match.white")}
          helperText={errors.player_white}
        />
        <PlayerSelect
          player={formData.player_black ?? emptyPlayer}
          setPlayer={(player) => onChange("player_black", player)}
          error={!!errors.player_black}
          label={t("match.black")}
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
          cell: createNumberCell("board", t("match.board")),
          header: t("match.board"),
          width: 80,
          hideBelow: "sm",
        },
        {
          field: "player_white",
          cell: playerSelectCell,
          header: t("match.white"),
        },
        {
          field: "player_black",
          cell: playerSelectCell,
          header: t("match.black"),
        },
        {
          field: "result",
          cell: resultToggleCell,
          width: resultWidth,
          editWidth: 220,
          isEditable: true,
        },
      ]}
      title={t("match.roundTitle", { competitionName, round })}
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
