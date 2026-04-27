import { formatHTTPValidationError } from "@/client/api";
import { CreateButton, CreateDialogConfig } from "@/components/CreateButton";
import EditableRow from "@/components/EditableRow";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { components } from "@/client/schema";
import {
  createLinkTextCell,
  createReadOnlyDateCell,
  createNonEmptyStringValidator,
} from "@/components/cellConfigs";
import { useCompetitions } from "./useCompetitions";
import { useAuth } from "@/auth";

type CompetitionPublic = components["schemas"]["CompetitionPublic"];

const tableCells = {
  name: createLinkTextCell(
    "competition-name",
    "Name",
    (name) => `/competitions/${name}`,
  ),
  created_at: createReadOnlyDateCell(),
  updated_at: createReadOnlyDateCell(),
};

const validateCompetitionName = createNonEmptyStringValidator("name");

const createDialogConfig: CreateDialogConfig<{ name: string }> = {
  getInitialFormData: () => {
    return {
      name: "",
    };
  },
  validateForm: (formData) => {
    const errors: Record<string, string> = {};
    validateCompetitionName(formData.name, errors);
    return errors;
  },
  sanitizeForm: (formData) => ({
    ...formData,
    name: formData.name.trim(),
  }),
  getRequestBody: (formData) => ({ ...formData, type: "simkro" }),
  renderContent: ({ formData, errors, onChange }) => {
    return (
      <TextField
        autoFocus
        fullWidth
        required
        name="competition-name"
        id="competition-name"
        label="Name"
        value={formData.name}
        error={!!errors.name}
        helperText={errors.name}
        onChange={(e) => onChange("name", e.target.value)}
      />
    );
  },
};

export default function CompetitionTable() {
  const [editableId, setEditableId] = useState("");
  const { isModerator } = useAuth();
  const {
    competitions,
    error,
    isPending,
    isError,
    createMutation,
    editMutation,
    deleteMutation,
  } = useCompetitions();

  const setIsEditing = (name: string, isEditing: boolean) => {
    setEditableId(isEditing ? name : "");
  };

  const sanitizeData = (competition: CompetitionPublic) => {
    return { ...competition, name: competition.name.trim() };
  };
  const validateData = (competition: CompetitionPublic) => {
    const errors: Record<string, string> = {};
    validateCompetitionName(competition.name, errors);
    return errors;
  };
  const getRequestBody = (competition: CompetitionPublic) => {
    return competition;
  };

  if (isPending) {
    return "Loading...";
  }

  if (isError) {
    const errorMessage = formatHTTPValidationError(error);
    console.log(errorMessage);
    return `An error occured: ${errorMessage}`;
  }

  const sortedCompetitions = [...(competitions ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );

  const nCols = Object.keys(tableCells).length + (isModerator ? 1 : 0);

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          {isModerator && (
            <TableRow>
              <TableCell align="right" colSpan={nCols}>
                <CreateButton
                  entityType="competition"
                  mutation={createMutation}
                  dialogConfig={createDialogConfig}
                />
              </TableCell>
            </TableRow>
          )}
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Created Date</TableCell>
            <TableCell>Updated Date</TableCell>
            {isModerator && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedCompetitions.map((competition) => (
            <EditableRow<CompetitionPublic>
              key={competition.name}
              data={competition}
              isEditing={editableId === competition.name}
              setIsEditing={(isEditing: boolean) =>
                setIsEditing(competition.name, isEditing)
              }
              cells={tableCells}
              entityIdField="name"
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
                      entityType: "competition",
                      entityNameField: "name",
                    }
                  : undefined
              }
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
